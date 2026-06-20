import TypeBadge from './TypeBadge'
import { STAT_LABELS } from './types'

const fmtName = (n) => n.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function PokemonCard({ pokemon }) {
  const { weaknesses, resistances, immunities, stats } = pokemon
  const maxStat = 255

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
    </article>
  )
}
