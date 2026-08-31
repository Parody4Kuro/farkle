import { describe, expect, it } from 'vitest'
import {
  canUseModifier,
  createModifierUsage,
  findBustProtector,
  getModifier,
  getTurnDiceCount,
  markModifierUsed,
  resetTurnModifierUsage,
} from './modifiers'
import { bankScore, cloneGameSettings, createInitialState, DEFAULT_GAME_SETTINGS, hasWon, isHotDice } from './rules'

describe('turn rules', () => {
  it('recognizes hot dice only after all remaining dice score', () => {
    expect(isHotDice(3, 3)).toBe(true)
    expect(isHotDice(4, 3)).toBe(false)
  })

  it('banks a turn without changing the other player score', () => {
    expect(bankScore({ human: 1700, ai: 900 }, 'human', 450)).toEqual({ human: 2150, ai: 900 })
  })

  it('supports multi-roll turn accumulation independently from totals', () => {
    const state = createInitialState()
    const accumulatedTurn = state.turnScore + 100 + 500
    expect(accumulatedTurn).toBe(600)
    expect(state.scores.human).toBe(0)
    expect(bankScore(state.scores, 'human', accumulatedTurn).human).toBe(600)
  })

  it('reaches the configurable target score', () => {
    expect(hasWon(4000, 4000)).toBe(true)
    expect(hasWon(3999, 4000)).toBe(false)
  })

  it('applies Loaded Hand without changing the base rules', () => {
    expect(getTurnDiceCount([], 6)).toBe(6)
    expect(getTurnDiceCount(['loaded-hand'], 6)).toBe(7)
    expect(getTurnDiceCount(['loaded-hand'], 6, 'ai')).toBe(6)
  })

  it('tracks turn and game modifier limits generically', () => {
    const luckyCharm = getModifier('lucky-charm')!
    const doubleDown = getModifier('double-down')!
    let usage = createModifierUsage()

    expect(findBustProtector(['lucky-charm'], usage)).toBe(luckyCharm)
    usage = markModifierUsed(usage, luckyCharm.id, 'turn')
    expect(findBustProtector(['lucky-charm'], usage)).toBeUndefined()

    usage = markModifierUsed(usage, doubleDown.id, 'game')
    expect(canUseModifier(doubleDown, usage)).toBe(false)
    expect(resetTurnModifierUsage(usage)).toEqual({ turn: {}, game: { 'double-down': 1 } })
  })

  it('clones game settings into an immutable match snapshot', () => {
    const draft = cloneGameSettings({
      ...DEFAULT_GAME_SETTINGS,
      dieLoadout: [...DEFAULT_GAME_SETTINGS.dieLoadout],
      modifierIds: ['loaded-hand'],
    })
    const state = createInitialState(draft)

    draft.targetScore = 10000
    draft.dieLoadout[0] = 'joker'
    draft.modifierIds.length = 0

    expect(state.config.targetScore).toBe(4000)
    expect(state.config.dieLoadout[0]).toBe('standard')
    expect(state.config.modifierIds).toEqual(['loaded-hand'])
    expect(state.diceToRoll).toBe(7)
  })
})
