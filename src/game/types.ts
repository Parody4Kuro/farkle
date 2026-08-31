export const JOKER = 'JOKER' as const

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6
export type DiceValue = DieFace | typeof JOKER
export type PlayerId = 'human' | 'ai'
export type AiDifficulty = 'conservative' | 'normal' | 'aggressive'
export type GamePhase =
  | 'ready'
  | 'rolling'
  | 'selecting'
  | 'ai_turn'
  | 'bust'
  | 'game_over'

export interface DieDefinition {
  id: string
  name: string
  weights: [number, number, number, number, number, number]
  description?: string
  jokerFace?: DieFace
}

export interface DieInstance {
  id: string
  definitionId: string
  value: DiceValue
  selected: boolean
}

export type ScoreGroupKind = 'single' | 'kind' | 'straight'

export interface ScoreGroup {
  kind: ScoreGroupKind
  score: number
  values: DiceValue[]
  dieIndices: number[]
  label: string
  jokerAs?: DieFace[]
}

export interface ScoreResult {
  score: number
  groups: ScoreGroup[]
  unusedDice: DiceValue[]
  unusedIndices: number[]
}

export interface SelectionValidation extends ScoreResult {
  valid: boolean
}

export interface GameSettings {
  targetScore: number
  aiDifficulty: AiDifficulty
  dieLoadout: string[]
  modifierIds: string[]
}

export interface GameStats {
  wins: number
  losses: number
  highestTurnScore: number
  longestRollStreak: number
}

export interface ModifierUsage {
  luckyCharmUsed: boolean
  goldenOneUsed: boolean
  doubleDownUsed: boolean
}

export interface GameState {
  currentPlayer: PlayerId
  targetScore: number
  scores: Record<PlayerId, number>
  turnScore: number
  rolledDice: DieInstance[]
  lockedDice: DieInstance[]
  diceToRoll: number
  phase: GamePhase
  winner?: PlayerId
  message: string
  rollStreak: number
  turnNumber: number
  isHotDice: boolean
  doubledSelection: boolean
  modifierUsage: ModifierUsage
}

export interface GameModifier {
  id: string
  name: string
  description: string
  modifyScore?: (score: number) => number
  modifyDice?: (diceCount: number) => number
  onBust?: (usage: ModifierUsage) => boolean
  onTurnStart?: () => void
  activeAbility?: 'golden-one' | 'double-down'
}
