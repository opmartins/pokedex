import { typeColor, typeLabel } from './types'

export default function TypeBadge({ type, multiplier, size = 'md' }) {
  return (
    <span
      className={`type-badge type-badge--${size}`}
      style={{ backgroundColor: typeColor(type) }}
    >
      {typeLabel(type)}
      {multiplier !== undefined && (
        <strong className="type-badge__mult">×{multiplier}</strong>
      )}
    </span>
  )
}
