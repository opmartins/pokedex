// Vercel Serverless Function: proxies Pokémon Showdown usage stats (published
// monthly by Smogon) and returns a compact { format, month, usage } map.
// Needed because smogon.com sends no CORS header, so the browser can't fetch it.

const DEFAULT_FORMAT = 'gen9championsvgc2026regma' // Pokémon Champions Reg M-A
const RATING = 1760 // high-ladder snapshot

// Smogon names -> PokéAPI slugs for forms that differ between the two.
const ALIASES = {
  urshifu: 'urshifu-single-strike',
  indeedee: 'indeedee-male',
  'indeedee-f': 'indeedee-female',
  landorus: 'landorus-incarnate',
  tornadus: 'tornadus-incarnate',
  thundurus: 'thundurus-incarnate',
  enamorus: 'enamorus-incarnate',
  basculegion: 'basculegion-male',
  meowstic: 'meowstic-male',
  morpeko: 'morpeko-full-belly',
}

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalize(name) {
  const slug = toSlug(name)
  if (ALIASES[slug]) return ALIASES[slug]
  // Ogerpon masks: "Ogerpon-Wellspring" -> "ogerpon-wellspring-mask"
  if (/^ogerpon-/.test(slug) && !slug.endsWith('-mask')) return `${slug}-mask`
  return slug
}

function monthFolder(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Warm-instance cache so we don't refetch the 6 MB source on every request.
let cache = null

export default async function handler(req, res) {
  const format = (req.query?.format || DEFAULT_FORMAT).replace(/[^a-z0-9]/g, '')

  if (cache && cache.format === format && cache.expires > Date.now()) {
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400')
    return res.status(200).json(cache.data)
  }

  // Stats publish ~1st of the following month, so try the last few months.
  const now = new Date()
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const month = monthFolder(d)
    const url = `https://www.smogon.com/stats/${month}/chaos/${format}-${RATING}.json`
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const json = await r.json()
      const usage = {}
      for (const [name, v] of Object.entries(json.data)) {
        usage[normalize(name)] = v.usage
      }
      const data = {
        format,
        month,
        available: true,
        count: Object.keys(usage).length,
        usage,
      }
      cache = { format, data, expires: Date.now() + 6 * 3600 * 1000 }
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400')
      return res.status(200).json(data)
    } catch {
      // try previous month
    }
  }

  // The format isn't published yet (e.g. a brand-new regulation). This is a
  // valid "no data" answer, not a server error — return 200 so the client can
  // tell it apart from the endpoint being unreachable.
  const data = { format, available: false, usage: null }
  cache = { format, data, expires: Date.now() + 3600 * 1000 }
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600')
  return res.status(200).json(data)
}
