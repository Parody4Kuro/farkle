import { getModifier, getTurnDiceCount, markModifierUsed, resetTurnModifierUsage } from './modifiers'
import { bankScore, cloneGameSettings, createInitialState, hasWon } from './rules'
import { modifierDisabledReason } from './selection'
import type {
  DieInstance,
  GamePhase,
  GameSettings,
  GameState,
  ModifierUseScope,
  PlayerId,
} from './types'

export type GameEvent =
  | { type: 'START_GAME'; config: GameSettings }
  | { type: 'BEGIN_TURN'; player: PlayerId; turnNumber: number }
  | { type: 'ROLL_STARTED'; diceCount: number; message: string }
  | { type: 'ROLL_RESOLVED'; dice: DieInstance[]; message: string; nextPhase: GamePhase; countPlayerRoll?: boolean }
  | { type: 'TOGGLE_DIE'; dieId: string }
  | { type: 'SET_MESSAGE'; message: string; phase?: GamePhase; hotDice?: boolean }
  | { type: 'USE_GOLDEN_ONE'; modifierId: string; scope: ModifierUseScope; dieId: string; message: string }
  | { type: 'USE_DOUBLE_DOWN'; modifierId: string; scope: ModifierUseScope; message: string }
  | { type: 'MARK_MODIFIER_USED'; modifierId: string; scope: ModifierUseScope }
  | { type: 'SHOW_SELECTION'; dice: DieInstance[]; message: string }
  | { type: 'LOCK_SELECTION'; keptDice: DieInstance[]; score: number; nextDiceCount: number; hotDice: boolean; message: string }
  | { type: 'BUST'; dice: DieInstance[]; message: string }
  | { type: 'BANK'; player: PlayerId; turnTotal: number; keptDice?: DieInstance[]; message: string; winningMessage: string }

export function gameReducer(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'START_GAME':
      return createInitialState(cloneGameSettings(event.config))

    case 'BEGIN_TURN': {
      const humanTurn = event.player === 'human'
      return {
        ...state,
        currentPlayer: event.player,
        turnScore: 0,
        rolledDice: [],
        lockedDice: [],
        diceToRoll: humanTurn ? getTurnDiceCount(state.config.modifierIds) : 6,
        phase: humanTurn ? 'ready' : 'ai_thinking',
        winner: undefined,
        message: humanTurn ? '轮到你了。准备好后掷骰。' : '酒馆老板正在收拢骰子……',
        rollStreak: 0,
        turnNumber: event.turnNumber,
        isHotDice: false,
        doubledSelection: false,
        modifierUsage: resetTurnModifierUsage(state.modifierUsage),
      }
    }

    case 'ROLL_STARTED':
      return {
        ...state,
        phase: 'rolling',
        rolledDice: [],
        diceToRoll: event.diceCount,
        isHotDice: false,
        message: event.message,
      }

    case 'ROLL_RESOLVED':
      return {
        ...state,
        phase: event.nextPhase,
        rolledDice: event.dice,
        diceToRoll: event.dice.length,
        rollStreak: state.rollStreak + (event.countPlayerRoll ? 1 : 0),
        message: event.message,
      }

    case 'TOGGLE_DIE':
      if (state.phase !== 'selecting' || state.currentPlayer !== 'human' || state.doubledSelection) return state
      return {
        ...state,
        rolledDice: state.rolledDice.map((die) => die.id === event.dieId ? { ...die, selected: !die.selected } : die),
      }

    case 'SET_MESSAGE':
      return {
        ...state,
        message: event.message,
        phase: event.phase ?? state.phase,
        isHotDice: event.hotDice ?? state.isHotDice,
      }

    case 'USE_GOLDEN_ONE':
      if (modifierDisabledReason(state, event.modifierId)
        || getModifier(event.modifierId)?.activation?.ability !== 'golden-one'
        || getModifier(event.modifierId)?.activation?.scope !== event.scope
        || !state.rolledDice.some((die) => die.id === event.dieId && die.selected)) return state
      return {
        ...state,
        rolledDice: state.rolledDice.map((die) => die.id === event.dieId ? { ...die, value: 1 } : die),
        modifierUsage: markModifierUsed(state.modifierUsage, event.modifierId, event.scope),
        message: event.message,
      }

    case 'USE_DOUBLE_DOWN':
      if (modifierDisabledReason(state, event.modifierId) || getModifier(event.modifierId)?.activation?.ability !== 'double-down'
        || getModifier(event.modifierId)?.activation?.scope !== event.scope) return state
      return {
        ...state,
        doubledSelection: true,
        modifierUsage: markModifierUsed(state.modifierUsage, event.modifierId, event.scope),
        message: event.message,
      }

    case 'MARK_MODIFIER_USED':
      return {
        ...state,
        modifierUsage: markModifierUsed(state.modifierUsage, event.modifierId, event.scope),
      }

    case 'SHOW_SELECTION':
      return { ...state, phase: 'ai_thinking', rolledDice: event.dice, message: event.message }

    case 'LOCK_SELECTION':
      return {
        ...state,
        phase: state.currentPlayer === 'human' ? 'rolling' : 'ai_thinking',
        turnScore: state.turnScore + event.score,
        lockedDice: [...state.lockedDice, ...event.keptDice.map((die) => ({ ...die, selected: false }))],
        rolledDice: [],
        diceToRoll: event.nextDiceCount,
        isHotDice: event.hotDice,
        doubledSelection: false,
        message: event.message,
      }

    case 'BUST':
      return {
        ...state,
        phase: 'bust',
        rolledDice: event.dice,
        turnScore: 0,
        lockedDice: [],
        isHotDice: false,
        doubledSelection: false,
        message: event.message,
      }

    case 'BANK': {
      const scores = bankScore(state.scores, event.player, event.turnTotal)
      const winner = hasWon(scores[event.player], state.config.targetScore) ? event.player : undefined
      return {
        ...state,
        scores,
        turnScore: winner ? event.turnTotal : 0,
        rolledDice: [],
        lockedDice: winner
          ? [...state.lockedDice, ...(event.keptDice ?? []).map((die) => ({ ...die, selected: false }))]
          : [],
        phase: winner ? 'game_over' : 'ai_thinking',
        winner,
        message: winner ? event.winningMessage : event.message,
      }
    }
  }
}
