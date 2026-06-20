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
