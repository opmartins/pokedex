const BASE = 'https://pokeapi.co/api/v2'

// Simple in-memory cache for type damage relations (they never change).
const typeCache = new Map()

// Cached list of every Pokémon name, fetched once for autocomplete.
let allNamesPromise = null

/**
 * Returns the full list of Pokémon names (lowercase). Fetched a single time
 * and cached, so filtering for suggestions happens locally on every keystroke.
 */
export function fetchAllNames() {
  if (!allNamesPromise) {
    allNamesPromise = fetch(`${BASE}/pokemon?limit=100000`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not load Pokémon list')
        return res.json()
      })
      .then((data) => data.results.map((r) => r.name))
      .catch((err) => {
        allNamesPromise = null // allow a retry on next call
        throw err
      })
  }
  return allNamesPromise
}

/**
 * Lightweight fetch of just a Pokémon's artwork URL (no type/matchup work).
 * Used to backfill the photo for older recent-search entries.
 */
export async function fetchSprite(name) {
  const res = await fetch(`${BASE}/pokemon/${encodeURIComponent(name.toLowerCase())}`)
  if (!res.ok) return null
  const p = await res.json()
  return (
    p.sprites?.other?.['official-artwork']?.front_default ||
    p.sprites?.front_default ||
    null
  )
}

async function getType(typeName) {
  if (typeCache.has(typeName)) return typeCache.get(typeName)
  const res = await fetch(`${BASE}/type/${typeName}`)
  if (!res.ok) throw new Error(`Failed to load type ${typeName}`)
  const data = await res.json()
  typeCache.set(typeName, data)
  return data
}

// Cache for ability descriptions (keyed by ability URL).
const abilityCache = new Map()

/**
 * Returns the English short description of an ability, or null if unavailable.
 * Failures are swallowed: the description is a nice-to-have, not essential.
 */
async function getAbilityDescription(url) {
  if (abilityCache.has(url)) return abilityCache.get(url)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('ability fetch failed')
    const data = await res.json()
    const en = (entry) => entry.language.name === 'en'
    const short = data.effect_entries.find(en)?.short_effect
    const full = data.effect_entries.find(en)?.effect
    const flavor = data.flavor_text_entries
      .find(en)
      ?.flavor_text?.replace(/[\n\f]/g, ' ')
    const desc = short || full || flavor || null
    abilityCache.set(url, desc)
    return desc
  } catch {
    abilityCache.set(url, null)
    return null
  }
}

/**
 * Computes the net defensive type chart for a Pokémon given its type list.
 * For each attacking type we multiply the effectiveness against every one of
 * the Pokémon's types. Result is grouped by multiplier.
 */
async function computeMatchups(types) {
  const typeData = await Promise.all(types.map((t) => getType(t)))

  // multiplier[attackingType] = product of effectiveness vs each owned type
  const multipliers = {}
  const ensure = (name) => {
    if (multipliers[name] === undefined) multipliers[name] = 1
  }

  for (const data of typeData) {
    const rel = data.damage_relations
    // Initialise every attacking type that appears, starting at 1.
    for (const list of [rel.double_damage_from, rel.half_damage_from, rel.no_damage_from]) {
      for (const t of list) ensure(t.name)
    }
  }

  for (const data of typeData) {
    const rel = data.damage_relations
    const factor = {}
    for (const t of rel.double_damage_from) factor[t.name] = 2
    for (const t of rel.half_damage_from) factor[t.name] = 0.5
    for (const t of rel.no_damage_from) factor[t.name] = 0
    for (const name of Object.keys(multipliers)) {
      multipliers[name] *= factor[name] ?? 1
    }
  }

  const weaknesses = [] // > 1
  const resistances = [] // 0 < x < 1
  const immunities = [] // 0

  for (const [name, mult] of Object.entries(multipliers)) {
    if (mult > 1) weaknesses.push({ name, mult })
    else if (mult === 0) immunities.push({ name, mult })
    else if (mult < 1) resistances.push({ name, mult })
  }

  const byMultDesc = (a, b) => b.mult - a.mult
  const byMultAsc = (a, b) => a.mult - b.mult
  weaknesses.sort(byMultDesc)
  resistances.sort(byMultAsc)

  return { weaknesses, resistances, immunities }
}

/**
 * Fetches a Pokémon by name (or id) and returns a normalised object with the
 * data we display: types, weaknesses and general info.
 */
export async function fetchPokemon(query) {
  const name = query.trim().toLowerCase()
  if (!name) throw new Error('Type the name of a Pokémon.')

  const res = await fetch(`${BASE}/pokemon/${encodeURIComponent(name)}`)
  if (res.status === 404) {
    throw new Error(`No Pokémon found for "${query}".`)
  }
  if (!res.ok) throw new Error('Error while querying the PokeAPI. Please try again.')

  const p = await res.json()
  const types = p.types
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name)

  const matchups = await computeMatchups(types)

  const abilities = await Promise.all(
    p.abilities.map(async (a) => ({
      name: a.ability.name,
      hidden: a.is_hidden,
      description: await getAbilityDescription(a.ability.url),
    })),
  )

  const sprite =
    p.sprites?.other?.['official-artwork']?.front_default ||
    p.sprites?.front_default ||
    null

  return {
    id: p.id,
    name: p.name,
    sprite,
    types,
    ...matchups,
    height: p.height / 10, // decimetres -> metres
    weight: p.weight / 10, // hectograms -> kilograms
    abilities,
    stats: p.stats.map((s) => ({
      name: s.stat.name,
      value: s.base_stat,
    })),
  }
}

/* ---------- Counters (Pokémon that hit the target super-effectively) ---------- */

// Cache of lightweight Pokémon summaries used to rank counters.
const summaryCache = new Map()

// Skip special battle forms so the list isn't dominated by Megas / Gigantamax.
const EXCLUDED_FORMS = /-(mega|gmax|totem|primal)/
const CANDIDATES_PER_TYPE = 20 // sample size when falling back to stat ranking
const USAGE_POOL = 90 // top-used Pokémon considered when usage data is available
const TOP_PER_TYPE = 6 // counters shown per weakness type

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function runPool(items, limit, fn) {
  const results = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchSummary(name) {
  if (summaryCache.has(name)) return summaryCache.get(name)
  try {
    const res = await fetch(`${BASE}/pokemon/${name}`)
    if (!res.ok) throw new Error('summary fetch failed')
    const p = await res.json()
    const total = p.stats.reduce((sum, s) => sum + s.base_stat, 0)
    const sprite =
      p.sprites?.other?.['official-artwork']?.front_default ||
      p.sprites?.front_default ||
      null
    const types = p.types.map((t) => t.type.name)
    const summary = { name: p.name, sprite, total, types }
    summaryCache.set(name, summary)
    return summary
  } catch {
    summaryCache.set(name, null)
    return null
  }
}

// Competitive usage map ({ pokeapiSlug: usageFraction }), fetched once via the
// serverless proxy. Returns null when unavailable (e.g. local `vite dev`).
let usagePromise = null
export function fetchUsage() {
  if (!usagePromise) {
    usagePromise = fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && d.usage ? d : null))
      .catch(() => null)
  }
  return usagePromise
}

/**
 * For each weakness type, returns the counters to show.
 * Preferred: Pokémon actually used by players (ranked by usage %), taken from
 * Showdown/Smogon usage stats. Falls back to strongest-by-base-stats when
 * usage data isn't available.
 * Returns: [{ type, mult, pokemon: [{ name, sprite, total, usage? }] }]
 */
export async function fetchCounters(weaknesses) {
  if (!weaknesses?.length) return []

  const usageData = await fetchUsage()
  if (usageData?.usage) {
    return countersByUsage(weaknesses, usageData.usage)
  }
  return countersByStats(weaknesses)
}

async function countersByUsage(weaknesses, usage) {
  const topUsed = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, USAGE_POOL)
    .map(([slug]) => slug)
    .filter((n) => !EXCLUDED_FORMS.test(n))

  const mons = (await runPool(topUsed, 10, fetchSummary)).filter(Boolean)

  return weaknesses.map((w) => ({
    type: w.name,
    mult: w.mult,
    pokemon: mons
      .filter((m) => m.types.includes(w.name))
      .sort((a, b) => (usage[b.name] ?? 0) - (usage[a.name] ?? 0))
      .slice(0, TOP_PER_TYPE)
      .map((m) => ({
        name: m.name,
        sprite: m.sprite,
        total: m.total,
        usage: usage[m.name],
      })),
  }))
}

async function countersByStats(weaknesses) {
  const perType = []
  const candidates = new Set()
  for (const w of weaknesses) {
    const typeData = await getType(w.name) // cached
    const sample = shuffle(
      typeData.pokemon
        .map((e) => e.pokemon.name)
        .filter((n) => !EXCLUDED_FORMS.test(n)),
    ).slice(0, CANDIDATES_PER_TYPE)
    perType.push({ type: w.name, mult: w.mult, names: sample })
    sample.forEach((n) => candidates.add(n))
  }

  const summaries = await runPool([...candidates], 10, fetchSummary)
  const byName = new Map(summaries.filter(Boolean).map((s) => [s.name, s]))

  return perType.map((t) => ({
    type: t.type,
    mult: t.mult,
    pokemon: t.names
      .map((n) => byName.get(n))
      .filter(Boolean)
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_PER_TYPE),
  }))
}
