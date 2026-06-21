import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPokemon, fetchAllNames, fetchSprite, fetchCounters } from './api'
import PokemonCard from './PokemonCard'

const RECENT_KEY = 'pokedex.recent'
const MAX_RECENT = 8
const MAX_SUGGESTIONS = 8

// Pokémon Champions regulations -> Showdown/Smogon usage format ids.
const REGULATIONS = [
  { key: 'ma', label: 'Reg M-A', format: 'gen9championsvgc2026regma' },
  { key: 'mb', label: 'Reg M-B', format: 'gen9championsvgc2026regmb' },
]

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    // Normalise: older versions stored plain name strings instead of objects.
    return parsed
      .map((item) =>
        typeof item === 'string'
          ? { name: item, sprite: null }
          : item && typeof item.name === 'string'
            ? { name: item.name, sprite: item.sprite ?? null }
            : null,
      )
      .filter(Boolean)
  } catch {
    return []
  }
}

const fmt = (n) => n.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function App() {
  const [query, setQuery] = useState('')
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [counters, setCounters] = useState(null)
  const [countersLoading, setCountersLoading] = useState(false)
  const [regulation, setRegulation] = useState('ma')
  const [recent, setRecent] = useState(loadRecent)

  const [allNames, setAllNames] = useState([])
  const [open, setOpen] = useState(false) // suggestions dropdown visible
  const [active, setActive] = useState(-1) // highlighted suggestion index
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  function clearQuery() {
    setQuery('')
    setActive(-1)
    setOpen(false)
    inputRef.current?.focus()
  }

  // Load the full name list once for autocomplete.
  useEffect(() => {
    fetchAllNames()
      .then(setAllNames)
      .catch(() => {}) // suggestions are optional; ignore failures
  }, [])

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
  }, [recent])

  // Backfill photos for recent entries saved before sprites were stored.
  useEffect(() => {
    const missing = recent.filter((p) => !p.sprite)
    if (missing.length === 0) return
    let cancelled = false
    Promise.all(
      missing.map(async (p) => ({ name: p.name, sprite: await fetchSprite(p.name) })),
    ).then((results) => {
      if (cancelled) return
      const map = new Map(results.map((r) => [r.name, r.sprite]))
      setRecent((prev) =>
        prev.map((p) =>
          !p.sprite && map.get(p.name) ? { ...p, sprite: map.get(p.name) } : p,
        ),
      )
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent.length])

  // Load counters whenever the Pokémon or the selected regulation changes.
  useEffect(() => {
    if (!pokemon) {
      setCounters(null)
      return
    }
    let cancelled = false
    const format = REGULATIONS.find((r) => r.key === regulation)?.format
    setCounters(null)
    setCountersLoading(true)
    fetchCounters(pokemon.weaknesses, format)
      .then((res) => {
        if (!cancelled) setCounters(res)
      })
      .catch(() => {
        if (!cancelled) setCounters({ status: 'fallback', month: null, groups: [] })
      })
      .finally(() => {
        if (!cancelled) setCountersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pokemon, regulation])

  // Close the dropdown when clicking outside the search box.
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Suggestions: prefix matches first, then "contains" matches.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || allNames.length === 0) return []
    const starts = []
    const contains = []
    for (const name of allNames) {
      if (name === q) continue
      if (name.startsWith(q)) starts.push(name)
      else if (name.includes(q)) contains.push(name)
      if (starts.length >= MAX_SUGGESTIONS) break
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
  }, [query, allNames])

  async function search(rawName) {
    const name = (rawName ?? query).trim()
    if (!name) return
    setOpen(false)
    setActive(-1)
    setLoading(true)
    setError('')
    try {
      const result = await fetchPokemon(name)
      setPokemon(result) // the [pokemon, regulation] effect loads counters
      setQuery(result.name)
      setRecent((prev) => {
        const entry = { name: result.name, sprite: result.sprite }
        const next = [entry, ...prev.filter((p) => p.name !== result.name)]
        return next.slice(0, MAX_RECENT)
      })
    } catch (err) {
      setPokemon(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      if (active >= 0) {
        e.preventDefault()
        const chosen = suggestions[active]
        setQuery(chosen)
        search(chosen)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  function goHome() {
    setPokemon(null)
    setError('')
    setQuery('')
    setCounters(null)
  }

  const onHome = !pokemon && !loading

  return (
    <div className={`app ${onHome ? 'app--home' : 'app--result'}`}>
      <header className="topbar">
        <button className="brand" onClick={goHome} title="Back to home">
          <img src="/pokeball.svg" alt="" className="brand__icon" />
          <span>
            Pokédex <em>Champions</em>
          </span>
        </button>
      </header>

      <main className="content">
        {onHome && (
          <p className="tagline">
            Search for a Pokémon and discover its types and weaknesses — get ready
            for battle in <strong>Pokémon Champions</strong>.
          </p>
        )}

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            search()
          }}
        >
          <div className="search__box" ref={boxRef}>
            <input
              ref={inputRef}
              type="text"
              className={`search__input ${query ? 'search__input--has-clear' : ''}`}
              placeholder="Type a Pokémon name (e.g. pikachu, charizard...)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
                setActive(-1)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              autoFocus
              autoComplete="off"
              role="combobox"
              aria-expanded={open && suggestions.length > 0}
              aria-controls="suggestions"
            />
            {query && (
              <button
                type="button"
                className="search__clear"
                onClick={clearQuery}
                aria-label="Clear search"
                title="Clear"
              >
                ✕
              </button>
            )}
            {open && suggestions.length > 0 && (
              <ul className="suggestions" id="suggestions" role="listbox">
                {suggestions.map((name, i) => (
                  <li key={name} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      className={`suggestions__item ${
                        i === active ? 'is-active' : ''
                      }`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        setQuery(name)
                        search(name)
                      }}
                    >
                      {fmt(name)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="search__btn" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {onHome && recent.length > 0 && (
          <section className="recent">
            <h2 className="recent__title">Recent searches</h2>
            <ul className="recent__list">
              {recent.map((p) => (
                <li key={p.name}>
                  <button
                    className="recent__item"
                    onClick={() => {
                      setQuery(p.name)
                      search(p.name)
                    }}
                  >
                    {p.sprite && (
                      <img src={p.sprite} alt="" className="recent__img" />
                    )}
                    {fmt(p.name)}
                  </button>
                </li>
              ))}
            </ul>
            <button className="recent__clear" onClick={() => setRecent([])}>
              Clear history
            </button>
          </section>
        )}

        {loading && <div className="loader">Loading data from the PokeAPI…</div>}

        {pokemon && !loading && (
          <>
            <button className="back-btn" onClick={goHome}>
              ← Back to home
            </button>
            <PokemonCard
              pokemon={pokemon}
              counters={counters}
              countersLoading={countersLoading}
              regulations={REGULATIONS}
              regulation={regulation}
              onRegulationChange={setRegulation}
              onSelect={(name) => {
                setQuery(name)
                search(name)
              }}
            />
          </>
        )}
      </main>

      <footer className="footer">
        Data provided by{' '}
        <a href="https://pokeapi.co" target="_blank" rel="noreferrer">
          PokeAPI
        </a>
      </footer>
    </div>
  )
}
