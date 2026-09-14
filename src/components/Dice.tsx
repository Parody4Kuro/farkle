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
  dieId?: string
  number?: number
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
  value, dieId, number,
  selected = false,
  locked = false,
  rolling = false,
  disabled = false,
  compact = false,
  name,
  onClick,
}: DiceProps) {
  const label = value === JOKER ? 'Joker 骰，显示骷髅面' : `骰子点数 ${value}`
  const className = `die ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''} ${rolling ? 'is-rolling' : ''} ${compact ? 'is-compact' : ''}`
  const accessibleLabel = `${label}${name ? `，${name}` : ''}${selected ? '，已选择' : ''}`
  const face = (
    <>
      {number && <small className="die-number" aria-hidden="true">{number}</small>}
      {value === JOKER ? (
        <span className="joker-face" aria-hidden="true">☠</span>
      ) : (
        <span className="pip-grid" aria-hidden="true">
          {PIP_POSITIONS[value].map((position) => <i className={`pip ${position}`} key={position} />)}
        </span>
      )}
      {locked && <span className="lock-mark" aria-hidden="true">◆</span>}
    </>
  )

  if (!disabled && onClick) {
    return (
      <button data-die-id={dieId} className={className} type="button" aria-label={accessibleLabel} aria-pressed={selected} onClick={onClick}>
        {face}
      </button>
    )
  }

  return <span className={className} role="img" aria-label={accessibleLabel}>{face}</span>
}
