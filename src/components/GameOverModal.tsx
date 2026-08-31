import type { PlayerId } from '../game/types'
import { AccessibleDialog } from './AccessibleDialog'

interface GameOverModalProps {
  winner: PlayerId
  humanScore: number
  aiScore: number
  onNewGame: () => void
  onSettings: () => void
}

export function GameOverModal({ winner, humanScore, aiScore, onNewGame, onSettings }: GameOverModalProps) {
  const humanWon = winner === 'human'
  return (
    <AccessibleDialog ariaLabelledBy="result-heading" className="result-dialog" dismissible={false}>
      <section className="result-modal">
        <span className="modal-ornament" aria-hidden="true">✦ ◆ ✦</span>
        <span className="eyebrow">最后一次投掷</span>
        <h2 id="result-heading" tabIndex={-1} data-autofocus>{humanWon ? '胜利属于你' : '庄家赢下此局'}</h2>
        <p>{humanWon ? '今晚，命运站在勇者这一边。' : '酒馆老板收下了这一局。再来一杯，再试一次。'}</p>
        <div className="final-score">
          <div><span>你</span><strong>{humanScore.toLocaleString()}</strong></div>
          <i>—</i>
          <div><span>酒馆老板</span><strong>{aiScore.toLocaleString()}</strong></div>
        </div>
        <button className="primary-action" type="button" onClick={onNewGame}>再玩一局</button>
        <button className="text-action" type="button" onClick={onSettings}>调整游戏设置</button>
      </section>
    </AccessibleDialog>
  )
}
