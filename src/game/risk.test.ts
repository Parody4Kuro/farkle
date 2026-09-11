import { expect, it } from 'vitest'
import { bustProbability, nextHumanLoadout } from './risk'
import { createInitialState } from './rules'

it('computes exact weighted bust risk rather than a count-only label', () => {
  expect(bustProbability(['standard'])).toBeCloseTo(2 / 3, 12)
  expect(bustProbability(['standard', 'standard'])).toBeCloseTo(4 / 9, 12)
  expect(bustProbability(['lucky-one', 'lucky-one'])).toBeCloseTo(0.16, 12)
  expect(bustProbability(['standard', 'lucky-one'])).toBeCloseTo(2 / 3 * 0.4, 12)
  expect(bustProbability(['lucky-one', 'standard'])).toBeCloseTo(2 / 3 * 0.4, 12)
  // With three dice, four non-scoring triples are also scoreable.
  expect(bustProbability(['standard', 'standard', 'standard'])).toBeCloseTo((64 - 4) / 216, 12)
  expect(bustProbability(['joker'])).toBeCloseTo(2 / 3, 12)
  expect(bustProbability(Array<string>(3).fill('joker'))).toBeLessThan(bustProbability(Array<string>(3).fill('standard')))
})

it('uses restored full loadout for Hot Dice and includes the extra ordinary die', () => {
  const game = createInitialState()
  game.config.dieLoadout[0] = 'joker'
  game.config.modifierIds = ['loaded-hand']
  game.rolledDice = [{ id: 'one', definitionId: 'standard', value: 1, selected: true }]
  expect(nextHumanLoadout(game)).toEqual(['joker', ...Array<string>(6).fill('standard')])
})
