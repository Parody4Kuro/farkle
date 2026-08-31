import { JOKER, type DiceValue } from '../game/types'

const PIP_POSITIONS: Record<number, string[]> = {
  1: ['mc'],
  2: ['tl', 'br'],
  3: ['tl', 'mc', 'br'],
  4: ['tl', 'tr', 'bl', 'br'],
  5: ['tl', 'tr', 'mc', 'bl', 'br'],
  6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
}

interface DiceProps {
  value: DiceValue
  selected?: boolean
  locked?: boolean
  rolling?: boolean
  disabled?: boolean
  compact?: boolean
  name?: string
  onClick?: () => void
}

export function Dice({
  value,
  selected = false,
  locked = false,
  rolling = false,
  disabled = false,
  compact = false,
  name,
  onClick,
}: DiceProps) {
  const label = value === JOKER ? 'Joker die showing a skull' : `Die showing ${value}`
  return (
    <button
      className={`die ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''} ${rolling ? 'is-rolling' : ''} ${compact ? 'is-compact' : ''}`}
      type="button"
      aria-label={`${label}${name ? `, ${name}` : ''}${selected ? ', selected' : ''}`}
      aria-pressed={disabled ? undefined : selected}
      disabled={disabled}
      onClick={onClick}
    >
      {value === JOKER ? (
        <span className="joker-face" aria-hidden="true">☠</span>
      ) : (
        <span className="pip-grid" aria-hidden="true">
          {PIP_POSITIONS[value].map((position) => <i className={`pip ${position}`} key={position} />)}
        </span>
      )}
      {locked && <span className="lock-mark" aria-hidden="true">◆</span>}
    </button>
  )
}
