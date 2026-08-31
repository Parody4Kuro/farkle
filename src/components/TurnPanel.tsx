import { getRiskLevel } from '../game/rules'
import type { PlayerId } from '../game/types'

interface TurnPanelProps {
  turnScore: number
  selectedScore: number
  selectedValid: boolean
  hasSelection: boolean
  diceRemaining: number
  currentPlayer: PlayerId
  message: string
  isHotDice: boolean
  doubledSelection: boolean
}

export function TurnPanel({
  turnScore,
  selectedScore,
  selectedValid,
  hasSelection,
  diceRemaining,
  currentPlayer,
  message,
  isHotDice,
  doubledSelection,
}: TurnPanelProps) {
  const risk = getRiskLevel(diceRemaining)
  return (
    <>
      <div className="turn-stats">
        <div><span>Turn score</span><strong>{turnScore.toLocaleString()}</strong></div>
        <div className={!selectedValid && hasSelection ? 'invalid-stat' : ''}>
          <span>Selected</span>
          <strong>{hasSelection ? selectedScore.toLocaleString() : '—'}{doubledSelection && <small>DOUBLE</small>}</strong>
        </div>
        <div><span>Dice remaining</span><strong>{diceRemaining}</strong></div>
        <div className={`risk risk-${risk.tone}`}><span>Risk</span><strong>{risk.label}</strong></div>
      </div>
      <div className={`game-message ${isHotDice ? 'hot-message' : ''}`} role="status" aria-live="polite">
        <span aria-hidden="true">{isHotDice ? '✦' : currentPlayer === 'human' ? '◆' : '♜'}</span>
        {message}
      </div>
    </>
  )
}
