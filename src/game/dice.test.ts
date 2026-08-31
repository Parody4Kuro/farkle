import { describe, expect, it } from 'vitest'
import { getDieDefinition, rollDie, weightedRandomFace } from './dice'
import { JOKER } from './types'

describe('weighted dice', () => {
  it('uses cumulative weights', () => {
    expect(weightedRandomFace([5, 1, 1, 1, 1, 1], () => 0)).toBe(1)
    expect(weightedRandomFace([5, 1, 1, 1, 1, 1], () => 0.99)).toBe(6)
  })

  it('maps the Joker die skull face to JOKER', () => {
    expect(rollDie(getDieDefinition('joker'), () => 0.99)).toBe(JOKER)
  })
})
