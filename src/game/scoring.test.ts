import { describe, expect, it } from 'vitest'
import { JOKER, type DiceValue } from './types'
import { calculateBestScore, hasAnyScore, validateSelectedDice } from './scoring'

describe('calculateBestScore', () => {
  it.each<[DiceValue[], number]>([
    [[1], 100],
    [[5], 50],
    [[1, 1], 200],
    [[5, 5], 100],
    [[1, 1, 1], 1000],
    [[2, 2, 2], 200],
    [[3, 3, 3], 300],
    [[4, 4, 4], 400],
    [[5, 5, 5], 500],
    [[6, 6, 6], 600],
    [[1, 1, 1, 1], 2000],
    [[1, 1, 1, 1, 1], 4000],
    [[1, 1, 1, 1, 1, 1], 8000],
    [[4, 4, 4, 4], 800],
    [[1, 2, 3, 4, 5], 500],
    [[2, 3, 4, 5, 6], 750],
    [[1, 2, 3, 4, 5, 6], 1500],
    [[1, 1, 1, 5, 5, 2], 1100],
    [[2, 2, 2, 1, 5, 6], 350],
  ])('scores %j as %i', (dice, expected) => {
    expect(calculateBestScore(dice).score).toBe(expected)
  })

  it('detects a bust', () => {
    const dice: DiceValue[] = [2, 2, 3, 3, 4, 6]
    expect(calculateBestScore(dice)).toMatchObject({ score: 0, groups: [] })
    expect(hasAnyScore(dice)).toBe(false)
  })

  it.each<[DiceValue[], number]>([
    [[1, 1, JOKER], 1000],
    [[6, 6, JOKER], 600],
    [[1, 2, 3, 4, JOKER], 500],
    [[2, 3, 4, 5, JOKER], 750],
  ])('uses a Joker optimally for %j', (dice, expected) => {
    expect(calculateBestScore(dice).score).toBe(expected)
  })

  it('does not award an isolated Joker', () => {
    expect(calculateBestScore([JOKER]).score).toBe(0)
  })
})

describe('validateSelectedDice', () => {
  it('requires every selected die to be consumed', () => {
    expect(validateSelectedDice([1, 2])).toMatchObject({
      valid: false,
      score: 100,
      unusedDice: [2],
    })
  })

  it('accepts a partially chosen scoring subset from a roll', () => {
    const roll: DiceValue[] = [1, 1, 5, 2, 3, 4]
    expect(validateSelectedDice([roll[0]])).toMatchObject({ valid: true, score: 100 })
    expect(validateSelectedDice([roll[0], roll[1], roll[2]])).toMatchObject({ valid: true, score: 250 })
  })

  it('splits multiple groups and consumes every die', () => {
    expect(validateSelectedDice([1, 1, 1, 5, 5])).toMatchObject({
      valid: true,
      score: 1100,
      unusedDice: [],
    })
  })

  it('never combines dice from separate roll calls', () => {
    const firstRoll = validateSelectedDice([1])
    const secondRoll = calculateBestScore([1, 1, 2, 3, 4])
    expect(firstRoll.score).toBe(100)
    expect(secondRoll.score).toBe(200)
    expect(secondRoll.score).not.toBe(1000)
  })
})
