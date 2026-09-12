import { describe, expect, it } from 'vitest'
import { CORE_IDS, SCORING_VERSION } from './cores'
import { getModifier } from './modifiers'
import { calculateBestScore, validateSelectedDice } from './scoring'
import { createInitialState } from './rules'
import { abilityEvent, evaluateSelection, modifierDisabledReason } from './selection'
import { gameReducer } from './state'
import type { DiceValue, GameState } from './types'

function selecting(values: DiceValue[], ids: string[], version = 1): GameState {
  const initial = createInitialState()
  return { ...initial, config: { ...initial.config, modifierIds: ids, scoringVersion: version }, phase: 'selecting',
    rolledDice: values.map((value, i) => ({ id: String(i), definitionId: value === 'JOKER' ? 'joker' : 'standard', value, selected: true })) }
}

describe('core scoring', () => {
  it('preserves the released version 1 partition, including a lower-base-score partition', () => {
    const result = validateSelectedDice([1, 1, 1], { modifierIds: ['core-steady'], version: 1 })
    expect(result.valid).toBe(true)
    expect(result.score).toBe(600)
    expect(result.groups.map((g) => g.kind)).toEqual(['single', 'single', 'single'])
    expect(result.groups.map((g) => g.baseScore)).toEqual([100, 100, 100])
    expect(calculateBestScore([1, 1, 1]).score).toBe(1000)
  })

  it.each<[DiceValue[], number]>([
    [[1], 200], [[1, 1], 400], [[1, 1, 1], 500], [[5], 100], [[5, 5], 200], [[5, 5, 5], 250],
    [[1, 1, 1, 1], 1000], [[1, 1, 1, 1, 1], 2000], [[1, 1, 1, 1, 1, 1], 4000],
    [[1, 1, 'JOKER'], 500], [[1, 1, 1, 5, 5, 5], 750],
    [[1, 1, 1, 2, 3, 4, 5], 650], [[1, 1, 1, 2, 3, 4, 'JOKER'], 650],
    [[1, 2, 3, 4, 5], 250], [[2, 3, 4, 5, 6], 375], [[1, 2, 3, 4, 5, 6], 750],
    [[1, 1, 1, 1, 1, 1, 1], 4200], [[5, 5, 5, 5, 5, 5, 5], 2100],
    [[1, 1, 1, 5, 5, 5, 'JOKER'], 1250],
  ])('scores the full version 2 selection %j as %i', (values, score) => {
    const result = validateSelectedDice(values, { modifierIds: ['core-steady'] })
    expect(result).toMatchObject({ valid: true, score, unusedIndices: [] })
    expect(result.groups.flatMap((group) => group.dieIndices).sort()).toEqual(values.map((_, i) => i))
    for (const face of [1, 5]) expect(result.groups.filter((group) => group.kind === 'single' && group.values[0] === face).length).toBeLessThanOrEqual(2)
    expect(validateSelectedDice([...values].reverse(), { modifierIds: ['core-steady'] }).score).toBe(score)
  })

  it('enforces the new limit without accepting unused dice or changing other cores', () => {
    const context = { modifierIds: ['core-steady'], version: SCORING_VERSION }
    expect(validateSelectedDice([1, 1, 1], context).groups.map((g) => g.kind)).toEqual(['kind'])
    expect(validateSelectedDice([1, 1, 1, 2], context)).toMatchObject({ valid: false, score: 500, unusedDice: [2] })
    expect(calculateBestScore([1, 1, 1, 2], context)).toMatchObject({ score: 500, unusedDice: [2] })
    expect(validateSelectedDice(['JOKER'], context).valid).toBe(false)
    expect(calculateBestScore([2, 3, 4, 6], context).score).toBe(0)
    expect(validateSelectedDice([3, 3, 3, 3, 3, 3, 3], context).valid).toBe(false)
    for (const id of ['core-kindred', 'core-wanderer']) {
      expect(validateSelectedDice([1, 1, 1, 5, 5, 5, 'JOKER'], { modifierIds: [id], version: 2 }))
        .toEqual(validateSelectedDice([1, 1, 1, 5, 5, 5, 'JOKER'], { modifierIds: [id], version: 1 }))
    }
    expect(getModifier('core-steady', 1)?.example).toContain('200 + 200 + 200')
    expect(getModifier('core-steady', 2)?.example).toContain('1000 × 0.5 = 500')
    expect(() => validateSelectedDice([1], { modifierIds: ['core-steady'], version: 999 })).toThrow('Unsupported scoring version')
  })

  it('previews and banks the same new-version total including double down', () => {
    const state = { ...selecting([1, 1, 1], ['core-steady', 'double-down'], 2), turnScore: 250 }
    expect(evaluateSelection(state)).toMatchObject({ baseScore: 1000, groupScore: 500, score: 500, bankTotal: 750 })
    const doubled = gameReducer(state, abilityEvent(state, 'double-down')!)
    const choice = evaluateSelection(doubled)
    expect(choice).toMatchObject({ score: 1000, bankTotal: 1250, doubleBonus: 500 })
    const banked = gameReducer(doubled, { type: 'BANK', player: 'human', turnTotal: choice.bankTotal, keptDice: choice.selectedDice, message: 'bank', winningMessage: 'win' })
    expect(banked.scores.human).toBe(1250)
    expect(evaluateSelection({ ...state, currentPlayer: 'ai' }).score).toBe(1000)
  })

  it('applies strengths, costs and Joker substitution to the actual groups', () => {
    expect(validateSelectedDice([5, 5, 5], { modifierIds: ['core-kindred'] }).score).toBe(750)
    expect(validateSelectedDice([5], { modifierIds: ['core-kindred'] }).score).toBe(25)
    expect(validateSelectedDice([3, 3, 'JOKER'], { modifierIds: ['core-wanderer'] }).score).toBe(600)
    expect(validateSelectedDice([3, 3, 3], { modifierIds: ['core-wanderer'] }).score).toBe(225)
    expect(validateSelectedDice([1, 2, 3, 4, 5], { modifierIds: ['core-wanderer'] }).score).toBe(1500)
    expect(validateSelectedDice([2, 3, 4, 5, 6], { modifierIds: ['core-wanderer'] }).score).toBe(2250)
    expect(validateSelectedDice([1, 2, 3, 4, 5, 'JOKER'], { modifierIds: ['core-wanderer'] }).score).toBe(4500)
  })

  it('keeps full-consumption distinct from the highest partial selection', () => {
    const values: DiceValue[] = [1, 1, 'JOKER', 2, 3, 4]
    const context = { modifierIds: ['core-wanderer'] }
    expect(calculateBestScore(values, context).score).toBe(2000)
    expect(validateSelectedDice(values, context)).toMatchObject({ valid: true, score: 1600, unusedIndices: [] })
  })

  it.each(CORE_IDS)('preserves legality, seven-die limits and isolated Jokers with %s', (id) => {
    const context = { modifierIds: [id] }
    expect(validateSelectedDice([1, 2], context).valid).toBe(false)
    expect(validateSelectedDice(['JOKER'], context).valid).toBe(false)
    expect(validateSelectedDice([3, 3, 3, 3, 3, 3, 3], context).valid).toBe(false)
    expect(validateSelectedDice([1, 1, 1, 1, 1, 1, 1], context).valid).toBe(true)
    expect(calculateBestScore([2, 3, 4, 6], context).score).toBe(0)
  })

  it('shares group totals, doubled selections and bank totals without equipping the opponent', () => {
    const state = { ...selecting([1, 1, 1], ['core-steady', 'double-down']), turnScore: 250 }
    expect(evaluateSelection(state)).toMatchObject({ baseScore: 300, groupScore: 600, score: 600, bankTotal: 850 })
    const doubled = gameReducer(state, abilityEvent(state, 'double-down')!)
    const choice = evaluateSelection(doubled)
    expect(choice).toMatchObject({ score: 1200, bankTotal: 1450, doubleBonus: 600 })
    const banked = gameReducer(doubled, { type: 'BANK', player: 'human', turnTotal: choice.bankTotal, keptDice: choice.selectedDice,
      message: 'bank', winningMessage: 'win' })
    expect(banked.scores.human).toBe(1450)
    expect(evaluateSelection({ ...state, currentPlayer: 'ai' }).score).toBe(1000)
  })

  it('allows a non-scoring golden target but freezes both values and selection after doubling', () => {
    let state = selecting([2], ['golden-one', 'double-down'])
    expect(evaluateSelection(state).valid).toBe(false)
    expect(modifierDisabledReason(state, 'golden-one')).toBeUndefined()
    expect(gameReducer(state, { type: 'USE_GOLDEN_ONE', modifierId: 'golden-one', scope: 'game', dieId: '0', message: 'wrong scope' })).toBe(state)
    expect(gameReducer(state, { type: 'USE_DOUBLE_DOWN', modifierId: 'golden-one', scope: 'turn', message: 'wrong ability' })).toBe(state)
    state = gameReducer(state, abilityEvent(state, 'golden-one')!)
    state = gameReducer(state, abilityEvent(state, 'double-down')!)
    expect(evaluateSelection(state).score).toBe(200)

    const five = selecting([5], ['golden-one', 'double-down'])
    const frozen = gameReducer(five, abilityEvent(five, 'double-down')!)
    expect(abilityEvent(frozen, 'golden-one')).toBeUndefined()
    expect(gameReducer(frozen, { type: 'USE_GOLDEN_ONE', modifierId: 'golden-one', scope: 'turn', dieId: '0', message: 'invalid' })).toBe(frozen)
    expect(gameReducer(frozen, { type: 'TOGGLE_DIE', dieId: '0' })).toBe(frozen)
  })
})
