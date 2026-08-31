import { describe, expect, it } from 'vitest'
import { chooseAiDice, shouldAiContinue } from './ai'

describe('AI strategy', () => {
  it('takes the best legal combination', () => {
    expect(chooseAiDice([1, 1, 1, 5, 2, 3])).toEqual({ indices: [0, 1, 2, 3], score: 1050 })
  })

  it('banks a winning turn', () => {
    expect(shouldAiContinue({
      difficulty: 'aggressive',
      turnScore: 300,
      remainingDice: 6,
      aiScore: 3800,
      humanScore: 3500,
      targetScore: 4000,
      hotDice: true,
    })).toBe(false)
  })

  it('makes aggressive play riskier than conservative play', () => {
    const context = {
      turnScore: 500,
      remainingDice: 3,
      aiScore: 1000,
      humanScore: 1800,
      targetScore: 4000,
      hotDice: false,
    } as const
    expect(shouldAiContinue({ ...context, difficulty: 'conservative' })).toBe(false)
    expect(shouldAiContinue({ ...context, difficulty: 'aggressive' })).toBe(true)
  })
})
