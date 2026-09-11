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
  riskPercent?: number
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
  riskPercent,
}: TurnPanelProps) {
  const risk = getRiskLevel(diceRemaining)
  return (
    <>
      <div className="turn-stats">
        <div><span>本回合</span><strong>{turnScore.toLocaleString()}</strong></div>
        <div className={!selectedValid && hasSelection ? 'invalid-stat' : ''}>
          <span>当前选择</span>
          <strong>{hasSelection ? selectedScore.toLocaleString() : '—'}{doubledSelection && <small>双倍</small>}</strong>
        </div>
        <div><span>剩余骰子</span><strong>{diceRemaining}</strong></div>
        <div className={`risk risk-${risk.tone}`}><span>{riskPercent === undefined ? '风险' : '下一投爆骰'}</span><strong>{riskPercent === undefined ? risk.label : `${(riskPercent * 100).toFixed(1)}%`}</strong></div>
      </div>
      <div className={`game-message ${isHotDice ? 'hot-message' : ''}`} role="status" aria-live="polite">
        <span aria-hidden="true">{isHotDice ? '✦' : currentPlayer === 'human' ? '◆' : '♜'}</span>
        {message}
      </div>
    </>
  )
}
