import { calculateBestScore } from './scoring'
import type { AiDifficulty, DiceValue, ScoringContext } from './types'

export interface AiDecisionContext {
  difficulty: AiDifficulty
  turnScore: number
  remainingDice: number
  aiScore: number
  humanScore: number
  targetScore: number
  hotDice: boolean
  bustProbability?: number
}

const BASE_BANK_THRESHOLD: Record<AiDifficulty, number> = {
  conservative: 350,
  normal: 600,
  aggressive: 900,
}

export function chooseAiDice(dice: DiceValue[], context?: ScoringContext): { indices: number[]; score: number } {
  const result = calculateBestScore(dice, context)
  const indices = [...new Set(result.groups.flatMap((group) => group.dieIndices))].sort((a, b) => a - b)
  return { indices, score: result.score }
}

export function shouldAiContinue(context: AiDecisionContext): boolean {
  const {
    difficulty,
    turnScore,
    remainingDice,
    aiScore,
    humanScore,
    targetScore,
    hotDice,
  } = context

  if (aiScore + turnScore >= targetScore) return false
  if (turnScore <= 0) return true

  let threshold = BASE_BANK_THRESHOLD[difficulty]
  const deficit = humanScore - aiScore
  const targetGap = targetScore - aiScore

  if (deficit >= 800) threshold += difficulty === 'conservative' ? 150 : 300
  if (deficit >= 1600) threshold += 250
  if (targetGap <= 900) threshold = Math.min(threshold, targetGap)
  if (hotDice) threshold += difficulty === 'aggressive' ? 500 : 250

  const dangerPenalty = context.bustProbability === undefined
    ? remainingDice <= 1 ? 450 : remainingDice === 2 ? 250 : remainingDice === 3 ? 100 : 0
    : Math.round(Math.max(0, Math.min(1, context.bustProbability)) * 650)
  return turnScore < Math.max(150, threshold - dangerPenalty)
}
