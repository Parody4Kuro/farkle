import type { AiDifficulty, PlayerId } from '../game/types'

interface ScoreBoardProps {
  scores: Record<PlayerId, number>
  currentPlayer: PlayerId
  targetScore: number
  difficulty: AiDifficulty
}

export function ScoreBoard({ scores, currentPlayer, targetScore, difficulty }: ScoreBoardProps) {
  return (
    <section className="scoreboard" aria-label="Score board">
      <article className={`score-card human ${currentPlayer === 'human' ? 'is-active' : ''}`}>
        <div>
          <span className="score-label">You</span>
          <strong>{scores.human.toLocaleString()}</strong>
        </div>
        {currentPlayer === 'human' && <span className="turn-seal">Your turn</span>}
      </article>
      <div className="target-score">
        <span>First to</span>
        <strong>{targetScore.toLocaleString()}</strong>
      </div>
      <article className={`score-card ai ${currentPlayer === 'ai' ? 'is-active' : ''}`}>
        <span className="ai-badge">AI · {difficulty}</span>
        <div>
          <span className="score-label">The Innkeeper</span>
          <strong>{scores.ai.toLocaleString()}</strong>
        </div>
      </article>
    </section>
  )
}
