import type { GameState, PlayerId } from './types'

export const DEFAULT_TARGET_SCORE = 4000

export const RISK_LABELS: Record<number, { label: string; tone: string }> = {
  0: { label: 'Hot ready', tone: 'hot' },
  1: { label: 'Extreme', tone: 'extreme' },
  2: { label: 'High', tone: 'high' },
  3: { label: 'Elevated', tone: 'elevated' },
  4: { label: 'Medium', tone: 'medium' },
  5: { label: 'Low', tone: 'low' },
  6: { label: 'Low', tone: 'low' },
  7: { label: 'Low', tone: 'low' },
}

export function getRiskLevel(diceCount: number): { label: string; tone: string } {
  return RISK_LABELS[Math.max(0, Math.min(7, diceCount))]
}

export function isHotDice(remainingDice: number, selectedDice: number): boolean {
  return selectedDice > 0 && remainingDice === selectedDice
}

export function bankScore(
  scores: Record<PlayerId, number>,
  player: PlayerId,
  turnScore: number,
): Record<PlayerId, number> {
  return { ...scores, [player]: scores[player] + turnScore }
}

export function hasWon(score: number, targetScore: number): boolean {
  return score >= targetScore
}

export function createInitialState(targetScore = DEFAULT_TARGET_SCORE): GameState {
  return {
    currentPlayer: 'human',
    targetScore,
    scores: { human: 0, ai: 0 },
    turnScore: 0,
    rolledDice: [],
    lockedDice: [],
    diceToRoll: 6,
    phase: 'ready',
    message: 'The table is yours. Cast the bones when ready.',
    rollStreak: 0,
    turnNumber: 1,
    isHotDice: false,
    doubledSelection: false,
    modifierUsage: {
      luckyCharmUsed: false,
      goldenOneUsed: false,
      doubleDownUsed: false,
    },
  }
}
