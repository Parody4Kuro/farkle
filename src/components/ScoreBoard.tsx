import type { AiDifficulty, PlayerId } from '../game/types'

const DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  conservative: '保守',
  normal: '均衡',
  aggressive: '激进',
}

interface ScoreBoardProps {
  scores: Record<PlayerId, number>
  currentPlayer: PlayerId
  targetScore: number
  difficulty: AiDifficulty
}

export function ScoreBoard({ scores, currentPlayer, targetScore, difficulty }: ScoreBoardProps) {
  return (
    <section className="scoreboard" aria-label="计分板">
      <article className={`score-card human ${currentPlayer === 'human' ? 'is-active' : ''}`}>
        <div>
          <span className="score-label">你</span>
          <strong>{scores.human.toLocaleString()}</strong>
        </div>
        {currentPlayer === 'human' && <span className="turn-seal">你的回合</span>}
      </article>
      <div className="target-score">
        <span>目标分数</span>
        <strong>{targetScore.toLocaleString()}</strong>
      </div>
      <article className={`score-card ai ${currentPlayer === 'ai' ? 'is-active' : ''}`}>
        <span className="ai-badge">AI · {DIFFICULTY_LABELS[difficulty]}</span>
        <div>
          <span className="score-label">酒馆老板</span>
          <strong>{scores.ai.toLocaleString()}</strong>
        </div>
      </article>
    </section>
  )
}
