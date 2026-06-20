// Type colors + display labels used across the UI.
export const TYPE_INFO = {
  normal: { label: 'Normal', color: '#9099a1' },
  fire: { label: 'Fire', color: '#ff9d55' },
  water: { label: 'Water', color: '#4d90d5' },
  electric: { label: 'Electric', color: '#f4d23c' },
  grass: { label: 'Grass', color: '#63bc5a' },
  ice: { label: 'Ice', color: '#73cec0' },
  fighting: { label: 'Fighting', color: '#ce4069' },
  poison: { label: 'Poison', color: '#ab6ac8' },
  ground: { label: 'Ground', color: '#d97746' },
  flying: { label: 'Flying', color: '#8fa8dd' },
  psychic: { label: 'Psychic', color: '#fa7179' },
  bug: { label: 'Bug', color: '#90c12c' },
  rock: { label: 'Rock', color: '#c7b78b' },
  ghost: { label: 'Ghost', color: '#5269ac' },
  dragon: { label: 'Dragon', color: '#0b6dc3' },
  dark: { label: 'Dark', color: '#5a5366' },
  steel: { label: 'Steel', color: '#5a8ea1' },
  fairy: { label: 'Fairy', color: '#ec8fe6' },
}

export function typeLabel(name) {
  return TYPE_INFO[name]?.label ?? name
}

export function typeColor(name) {
  return TYPE_INFO[name]?.color ?? '#777'
}

export const STAT_LABELS = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Speed',
}
