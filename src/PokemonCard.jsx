import TypeBadge from './TypeBadge'
import { STAT_LABELS } from './types'

const fmtName = (n) => n.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function RegToggle({ regulations, regulation, onChange }) {
  if (!regulations.length) return null
  return (
    <div className="reg-toggle" role="group" aria-label="Regulation">
      {regulations.map((r) => (
        <button
          key={r.key}
          className={`reg-toggle__btn ${r.key === regulation ? 'is-active' : ''}`}
          onClick={() => onChange?.(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// A clickable chip for a competitively-used Pokémon (counter or target).
function UsageChip({ p, onSelect }) {
  return (
    <button
      className="counter"
      onClick={() => onSelect?.(p.name)}
      title={`${fmtName(p.name)} · ${p.total} base total${
        p.mult ? ` · ×${p.mult} damage` : ''
      }`}
    >
      {p.sprite && <img src={p.sprite} alt="" />}
      <span>{fmtName(p.name)}</span>
      {p.usage != null && (
        <strong className="counter__usage">{(p.usage * 100).toFixed(1)}%</strong>
      )}
    </button>
  )
}

export default function PokemonCard({
  pokemon,
  counters,
  countersLoading,
  strongAgainst,
  strongLoading,
  regulations = [],
  regulation,
  onRegulationChange,
  onSelect,
}) {
  const { weaknesses, resistances, immunities, stats } = pokemon
  const maxStat = 255
  const groups = counters?.groups ?? []
  const hasCounters = groups.some((g) => g.pokemon.length > 0)
  const strongGroups = strongAgainst?.groups ?? []
  const hasStrong = strongGroups.some((g) => g.pokemon.length > 0)

  return (
    <article className="card">
      <header className="card__head">
        <div className="card__art">
          {pokemon.sprite ? (
            <img src={pokemon.sprite} alt={pokemon.name} />
          ) : (
            <div className="card__art--empty">No image</div>
          )}
        </div>
        <div className="card__id">
          <span className="card__num">#{String(pokemon.id).padStart(4, '0')}</span>
          <h2 className="card__name">{fmtName(pokemon.name)}</h2>
          <div className="badge-row">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} size="lg" />
            ))}
          </div>
        </div>
      </header>

      {/* Highlighted: types & weaknesses */}
      <section className="highlight">
        <div className="highlight__block highlight__block--weak">
          <h3>⚠️ Weaknesses</h3>
          {weaknesses.length ? (
            <div className="badge-row">
              {weaknesses.map((w) => (
                <TypeBadge key={w.name} type={w.name} multiplier={w.mult} />
              ))}
            </div>
          ) : (
            <p className="muted">No notable weaknesses.</p>
          )}
        </div>
      </section>

      <div className="secondary-grid">
        {resistances.length > 0 && (
          <section className="info-block">
            <h3>🛡️ Resistances</h3>
            <div className="badge-row">
              {resistances.map((r) => (
                <TypeBadge key={r.name} type={r.name} multiplier={r.mult} />
              ))}
            </div>
          </section>
        )}

        {immunities.length > 0 && (
          <section className="info-block">
            <h3>🚫 Immunities</h3>
            <div className="badge-row">
              {immunities.map((i) => (
                <TypeBadge key={i.name} type={i.name} multiplier={0} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Other info */}
      <section className="info-block">
        <h3>Abilities</h3>
        <div className="abilities">
          {pokemon.abilities.map((a) => (
            <span
              key={a.name}
              className="ability"
              tabIndex={0}
              aria-label={a.description || fmtName(a.name)}
            >
              {fmtName(a.name)}
              {a.hidden && <span className="ability__tag">hidden</span>}
              {a.description && (
                <span className="ability__tip" role="tooltip">
                  {a.description}
                </span>
              )}
            </span>
          ))}
        </div>
      </section>

      <section className="info-block">
        <h3>Base stats</h3>
        <ul className="stats">
          {stats.map((s) => (
            <li key={s.name}>
              <span className="stats__label">{STAT_LABELS[s.name] ?? s.name}</span>
              <span className="stats__bar">
                <span
                  className="stats__fill"
                  style={{ width: `${(s.value / maxStat) * 100}%` }}
                />
              </span>
              <span className="stats__val">{s.value}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Strong counters: most-used Pokémon (per Champions regulation) that hit
          this one super-effectively with their own type */}
      {weaknesses.length > 0 && (
        <section className="info-block">
          <div className="counters__header">
            <h3>💥 Strong counters</h3>
            <RegToggle
              regulations={regulations}
              regulation={regulation}
              onChange={onRegulationChange}
            />
          </div>
          <p className="muted counters__hint">
            Most-used Pokémon Champions Pokémon (by Showdown usage) whose type hits
            this one super-effectively. Click to look one up.
          </p>

          {countersLoading && !hasCounters && (
            <p className="muted">Finding counters…</p>
          )}
          {!countersLoading && counters?.status === 'nodata' && (
            <p className="muted">
              No usage data published yet for this regulation. Try Reg M-A.
            </p>
          )}
          {!countersLoading && counters?.status === 'fallback' && (
            <p className="muted">
              Usage data unavailable — showing strongest by base stats (may include
              Pokémon not legal in Champions).
            </p>
          )}

          {groups.map(
            (group) =>
              group.pokemon.length > 0 && (
                <div key={group.type} className="counters__group">
                  <TypeBadge type={group.type} multiplier={group.mult} />
                  <div className="counters__list">
                    {group.pokemon.map((p) => (
                      <UsageChip key={p.name} p={p} onSelect={onSelect} />
                    ))}
                  </div>
                </div>
              ),
          )}
        </section>
      )}

      {/* Strong against: most-used Pokémon this one hits super-effectively */}
      {pokemon.types.length > 0 && (
        <section className="info-block">
          <div className="counters__header">
            <h3>⚔️ Strong against</h3>
            <RegToggle
              regulations={regulations}
              regulation={regulation}
              onChange={onRegulationChange}
            />
          </div>
          <p className="muted counters__hint">
            Most-used Pokémon Champions Pokémon that this one hits super-effectively
            with its own type. Click to look one up.
          </p>

          {strongLoading && !hasStrong && (
            <p className="muted">Finding targets…</p>
          )}
          {!strongLoading && strongAgainst?.status === 'nodata' && (
            <p className="muted">
              No usage data published yet for this regulation. Try Reg M-A.
            </p>
          )}
          {!strongLoading && strongAgainst?.status === 'fallback' && (
            <p className="muted">Usage data unavailable right now.</p>
          )}
          {!strongLoading && strongAgainst?.status === 'ok' && !hasStrong && (
            <p className="muted">
              Not super-effective against common Pokémon in this regulation.
            </p>
          )}

          {strongGroups.map(
            (group) =>
              group.pokemon.length > 0 && (
                <div key={group.type} className="counters__group">
                  <TypeBadge type={group.type} />
                  <div className="counters__list">
                    {group.pokemon.map((p) => (
                      <UsageChip key={p.name} p={p} onSelect={onSelect} />
                    ))}
                  </div>
                </div>
              ),
          )}
        </section>
      )}
    </article>
  )
}
