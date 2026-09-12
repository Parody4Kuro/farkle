export const JOKER = 'JOKER' as const

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6
export type DiceValue = DieFace | typeof JOKER
export type PlayerId = 'human' | 'ai'
export type AiDifficulty = 'conservative' | 'normal' | 'aggressive'
export type GamePhase =
  | 'ready'
  | 'rolling'
  | 'selecting'
  | 'ai_thinking'
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
  baseScore?: number
  adjustments?: Array<{ modifierId: string; label: string; amount: number }>
}

export interface ScoringContext {
  modifierIds: readonly string[]
  player?: PlayerId
  version?: number
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
  scoringVersion?: number
}

export interface GameStats {
  wins: number
  losses: number
  highestTurnScore: number
  longestRollStreak: number
}

export interface ModifierUsage {
  turn: Record<string, number>
  game: Record<string, number>
}

export type ModifierUseScope = 'turn' | 'game'
export type ModifierAbility = 'golden-one' | 'double-down'

export interface ModifierActivation {
  ability: ModifierAbility
  scope: ModifierUseScope
  maxUses: number
}

export interface ModifierUseLimit {
  scope: ModifierUseScope
  maxUses: number
}

export interface AudioPreferences {
  enabled: boolean
  volume: number
}

export interface GameState {
  currentPlayer: PlayerId
  config: GameSettings
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
  symbol: string
  category?: 'core'
  adventureOnly?: boolean
  benefit?: string
  cost?: string
  example?: string
  modifyGroup?: (group: ScoreGroup, context: { player: PlayerId; version: number }) => number
  modifyScore?: (score: number, context: { player: PlayerId }) => number
  modifyDice?: (diceCount: number, context: { player: PlayerId }) => number
  onBust?: () => 'reroll'
  onTurnStart?: () => void
  activation?: ModifierActivation
  useLimit?: ModifierUseLimit
}
