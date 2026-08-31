import { describe, expect, it } from 'vitest'
import { bankScore, createInitialState, hasWon, isHotDice } from './rules'
import { hasActiveAbility, shouldPreventBust, getTurnDiceCount } from './modifiers'

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
  })

  it('dispatches active and bust abilities through modifier definitions', () => {
    expect(hasActiveAbility(['golden-one'], 'golden-one')).toBe(true)
    expect(shouldPreventBust(['lucky-charm'], {
      luckyCharmUsed: false,
      goldenOneUsed: false,
      doubleDownUsed: false,
    })).toBe(true)
    expect(shouldPreventBust(['lucky-charm'], {
      luckyCharmUsed: true,
      goldenOneUsed: false,
      doubleDownUsed: false,
    })).toBe(false)
  })
})
