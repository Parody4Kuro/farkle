import type { PlayerId } from '../game/types'

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
    <div className="modal-backdrop">
      <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-heading">
        <span className="modal-ornament" aria-hidden="true">✦ ◆ ✦</span>
        <span className="eyebrow">The final cast</span>
        <h2 id="result-heading">{humanWon ? 'Victory is yours' : 'The house prevails'}</h2>
        <p>{humanWon ? 'Fortune favors the bold tonight.' : 'The Innkeeper claims this round. Another cup, another chance.'}</p>
        <div className="final-score">
          <div><span>You</span><strong>{humanScore.toLocaleString()}</strong></div>
          <i>—</i>
          <div><span>Innkeeper</span><strong>{aiScore.toLocaleString()}</strong></div>
        </div>
        <button className="primary-action" type="button" onClick={onNewGame}>Play Again</button>
        <button className="text-action" type="button" onClick={onSettings}>Change the wager</button>
      </section>
    </div>
  )
}
