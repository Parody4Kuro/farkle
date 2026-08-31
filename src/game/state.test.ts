import { describe, expect, it } from 'vitest'
import { createInitialState, DEFAULT_GAME_SETTINGS } from './rules'
import { gameReducer } from './state'
import type { DieInstance, GameSettings, GameState } from './types'

function die(id: string, value: DieInstance['value'], selected = false): DieInstance {
  return { id, definitionId: 'standard', value, selected }
}

function settings(updates: Partial<GameSettings> = {}): GameSettings {
  return {
    ...DEFAULT_GAME_SETTINGS,
    dieLoadout: [...DEFAULT_GAME_SETTINGS.dieLoadout],
    modifierIds: [],
    ...updates,
  }
}

describe('gameReducer', () => {
  it('starts a match with a cloned configuration snapshot', () => {
    const draft = settings({ targetScore: 2000, modifierIds: ['loaded-hand'] })
    const state = gameReducer(createInitialState(), { type: 'START_GAME', config: draft })

    draft.targetScore = 10000
    draft.modifierIds.length = 0

    expect(state.config.targetScore).toBe(2000)
    expect(state.config.modifierIds).toEqual(['loaded-hand'])
    expect(state.diceToRoll).toBe(7)
  })

  it('moves a legal selection into the locked tray and preserves the turn total', () => {
    const rolled = [die('one', 1, true), die('two', 2)]
    let state: GameState = { ...createInitialState(), phase: 'selecting', rolledDice: rolled }
    state = gameReducer(state, {
      type: 'LOCK_SELECTION',
      keptDice: [rolled[0]],
      score: 100,
      nextDiceCount: 1,
      hotDice: false,
      message: 'locked',
    })

    expect(state).toMatchObject({ phase: 'rolling', turnScore: 100, diceToRoll: 1 })
    expect(state.lockedDice).toEqual([die('one', 1)])
  })

  it('banks against the active match target and declares the winner', () => {
    const initial = createInitialState(settings({ targetScore: 2000 }))
    const nearWin = { ...initial, scores: { human: 1900, ai: 700 }, turnScore: 100 }
    const state = gameReducer(nearWin, {
      type: 'BANK',
      player: 'human',
      turnTotal: 150,
      message: 'banked',
      winningMessage: 'won',
    })

    expect(state.scores).toEqual({ human: 2050, ai: 700 })
    expect(state).toMatchObject({ winner: 'human', phase: 'game_over', message: 'won' })
  })

  it('clears an unbanked turn on bust without changing saved scores', () => {
    const initial = createInitialState()
    const active = {
      ...initial,
      phase: 'selecting' as const,
      scores: { human: 500, ai: 300 },
      turnScore: 650,
      lockedDice: [die('locked', 1)],
    }
    const state = gameReducer(active, { type: 'BUST', dice: [die('bad', 2)], message: 'bust' })

    expect(state.scores).toEqual({ human: 500, ai: 300 })
    expect(state.turnScore).toBe(0)
    expect(state.lockedDice).toEqual([])
    expect(state.phase).toBe('bust')
  })

  it('resets turn-scoped modifier use while keeping game-scoped use', () => {
    const initial = {
      ...createInitialState(settings({ modifierIds: ['loaded-hand'] })),
      modifierUsage: { turn: { 'golden-one': 1 }, game: { 'double-down': 1 } },
    }
    const state = gameReducer(initial, { type: 'BEGIN_TURN', player: 'human', turnNumber: 3 })

    expect(state.modifierUsage).toEqual({ turn: {}, game: { 'double-down': 1 } })
    expect(state.diceToRoll).toBe(7)
    expect(state.turnNumber).toBe(3)
  })

  it('applies active abilities through reducer events', () => {
    const initial = {
      ...createInitialState(),
      phase: 'selecting' as const,
      rolledDice: [die('chosen', 6, true)],
    }
    const golden = gameReducer(initial, {
      type: 'USE_GOLDEN_ONE',
      modifierId: 'golden-one',
      scope: 'turn',
      dieId: 'chosen',
      message: 'golden',
    })
    const doubled = gameReducer(golden, {
      type: 'USE_DOUBLE_DOWN',
      modifierId: 'double-down',
      scope: 'game',
      message: 'double',
    })

    expect(golden.rolledDice[0].value).toBe(1)
    expect(doubled.doubledSelection).toBe(true)
    expect(doubled.modifierUsage).toEqual({
      turn: { 'golden-one': 1 },
      game: { 'double-down': 1 },
    })
  })
})
