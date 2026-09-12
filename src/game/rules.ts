import { DEFAULT_LOADOUT } from './dice'
import { createModifierUsage, getTurnDiceCount } from './modifiers'
import type { GameSettings, GameState, PlayerId } from './types'

export const DEFAULT_TARGET_SCORE = 4000
export const TARGET_SCORE_OPTIONS = [2000, 4000, 6000, 10000] as const

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  targetScore: DEFAULT_TARGET_SCORE,
  aiDifficulty: 'normal',
  dieLoadout: [...DEFAULT_LOADOUT],
  modifierIds: [],
}

export const RISK_LABELS: Record<number, { label: string; tone: string }> = {
  0: { label: 'Hot Dice', tone: 'hot' },
  1: { label: '极高', tone: 'extreme' },
  2: { label: '高', tone: 'high' },
  3: { label: '较高', tone: 'elevated' },
  4: { label: '中等', tone: 'medium' },
  5: { label: '低', tone: 'low' },
  6: { label: '低', tone: 'low' },
  7: { label: '低', tone: 'low' },
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

export function cloneGameSettings(settings: GameSettings): GameSettings {
  return {
    ...(settings.scoringVersion !== undefined ? { scoringVersion: settings.scoringVersion } : {}),
    targetScore: settings.targetScore,
    aiDifficulty: settings.aiDifficulty,
    dieLoadout: [...settings.dieLoadout],
    modifierIds: [...settings.modifierIds],
  }
}

export function createInitialState(settings: GameSettings = DEFAULT_GAME_SETTINGS): GameState {
  return {
    currentPlayer: 'human',
    config: cloneGameSettings(settings),
    scores: { human: 0, ai: 0 },
    turnScore: 0,
    rolledDice: [],
    lockedDice: [],
    diceToRoll: getTurnDiceCount(settings.modifierIds),
    phase: 'ready',
    message: '轮到你了。准备好后掷骰。',
    rollStreak: 0,
    turnNumber: 1,
    isHotDice: false,
    doubledSelection: false,
    modifierUsage: createModifierUsage(),
  }
}
