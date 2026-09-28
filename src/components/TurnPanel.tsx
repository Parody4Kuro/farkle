import { AnimatedScore } from './PresentationHUD'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { PlayerId } from '../game/types'

interface TurnPanelProps {
  presentation?: RollPresentation
  turnScore: number
  selectedScore: number
  selectedValid: boolean
  hasSelection: boolean
  diceRemaining: number
  currentPlayer: PlayerId
  message: string
  isHotDice: boolean
  doubledSelection: boolean
  riskPercent?: number
}

export function TurnPanel({
  presentation,
  turnScore,
  selectedScore,
  selectedValid,
  hasSelection,
  diceRemaining,
  currentPlayer,
  message,
  isHotDice,
  doubledSelection,
  riskPercent: _riskPercent,
}: TurnPanelProps) {
  return (
    <>
      <div className="turn-stats">
        <div><span>本回合</span><strong><AnimatedScore value={turnScore} field="turn" player={currentPlayer} presentation={presentation} /></strong></div>
        <div className={!selectedValid && hasSelection ? 'invalid-stat' : ''}>
          <span>当前选择</span>
          <strong>{hasSelection ? selectedScore.toLocaleString() : '—'}{doubledSelection && <small>双倍</small>}</strong>
        </div>
        <div><span>剩余骰子</span><strong>{diceRemaining}</strong></div>
        <div><span>可落袋</span><strong>{selectedValid ? (turnScore + selectedScore).toLocaleString() : '—'}</strong></div>
      </div>
      <div className={`game-message ${isHotDice ? 'hot-message' : ''}`} role="status" aria-live="polite">
        <span aria-hidden="true">{isHotDice ? '✦' : currentPlayer === 'human' ? '◆' : '♜'}</span>
        {message}
      </div>
    </>
  )
}
