import { describe, expect, it } from 'vitest'
import { adventureReducer as reduce, createAdventure, type AdventureRun } from './adventure'
import { createInitialState } from './rules'
import { normalizeAdventure, recordAdventure, EMPTY_PROFILE } from '../storage/adventureStorage'
import type { DiceValue } from './types'
import { addInventoryItem, createInventory } from './inventory'
import { evaluateSelection } from './selection'

function opened(seed: number, id: string) { return reduce(createAdventure(seed, id), { type: 'SELECT_CORE', id: 'core-steady' }) }
function bare(seed: number, id: string): AdventureRun { const run = opened(seed, id); return { ...run, modifiers: [] } }

function selected(run: AdventureRun, values: DiceValue[], total = 0): AdventureRun {
  return { ...run, stage: 'playing', flow: 'selecting', game: { ...run.game, currentPlayer: 'human', phase: 'selecting',
    turnScore: total, rolledDice: values.map((value, i) => ({ id: `d${i}`, definitionId: value === 'JOKER' ? 'joker' : 'standard', value, selected: true })) } }
}
function win(run: AdventureRun) { return reduce(selected(run, [1], 4000), { type: 'BANK' }) }
function lose(run: AdventureRun) {
  const match = selected(run, [1], 4000)
  return reduce({ ...match, flow: 'decide', game: { ...match.game, currentPlayer: 'ai', phase: 'ai_thinking' } }, { type: 'TICK' })
}

describe('four tables adventure', () => {
  it('locks new ledger scores, keeps later singles separate, and loses the whole hot turn on bust', () => {
    let run = reduce(opened(41, 'ledger'), { type: 'SIT' })
    run = selected(run, [1, 1, 1, 2], 300)
    run.game = { ...run.game, scores: { human: 250, ai: 100 },
      rolledDice: run.game.rolledDice.map((die) => ({ ...die, selected: die.value === 1 })) }
    expect(evaluateSelection(run.game)).toMatchObject({ score: 500, bankTotal: 800 })
    run = reduce(run, { type: 'ROLL' })
    expect(run.game.turnScore).toBe(800)
    expect(run.game.lockedDice).toHaveLength(3)
    expect(run.pendingDice).toHaveLength(1)
    run = reduce({ ...run, pendingDice: run.pendingDice.map((die) => ({ ...die, value: 1 })) }, { type: 'ROLL_FINISHED' })
    run = reduce(run, { type: 'TOGGLE', id: run.game.rolledDice[0].id })
    expect(evaluateSelection(run.game)).toMatchObject({ score: 200, bankTotal: 1000 })
    expect(reduce(run, { type: 'BANK' }).game.scores.human).toBe(1250)
    run = reduce(run, { type: 'ROLL' })
    expect(run.lastEvent).toMatchObject({ type: 'LOCK_SELECTION', hotDice: true, score: 200 })
    expect(run.game.turnScore).toBe(1000)
    expect(run.pendingDice).toHaveLength(6)
    run = reduce({ ...run, pendingDice: run.pendingDice.map((die, i) => ({ ...die, value: ([2, 3, 4, 6, 2, 3] as const)[i] })) }, { type: 'ROLL_FINISHED' })
    expect(run.flow).toBe('bust')
    expect(run.game.turnScore).toBe(0)
    expect(run.game.scores.human).toBe(250)
  })

  it('retains old scoring when retrying a lost table', () => {
    const old = { ...opened(41, 'old-retry'), scoringVersion: 1 as const }
    const lost = lose(reduce(old, { type: 'SIT' }))
    const retry = reduce(lost, { type: 'SIT' })
    expect(retry.game.config.scoringVersion).toBe(1)
    expect(evaluateSelection(selected(retry, [1, 1, 1]).game).score).toBe(600)
  })
  it('offers one persistent choice per ordinary victory and ends at the boss', () => {
    let run = opened(27, 'test')
    for (let table = 0; table < 3; table++) {
      run = reduce(run, { type: 'SIT' })
      expect(run.game.config.targetScore).toBe(2000)
      run = win(run)
      expect(run.stage).toBe('reward')
      expect(new Set(run.rewards.map((r) => r.id)).size).toBe(3)
      const pick = { type: 'REWARD' as const, id: run.rewards[0].id, offerId: run.rewardOfferId! }
      run = reduce(run, pick)
      expect(reduce(run, pick)).toBe(run)
      expect(run.table).toBe(table + 1)
    }
    run = reduce(run, { type: 'SIT' })
    expect(run.game.config.targetScore).toBe(4000)
    run = win(run)
    expect(run.stage).toBe('won')
    expect(run.history).toHaveLength(4)
    const profile = recordAdventure(EMPTY_PROFILE, run)
    expect(profile.wins).toBe(1)
    expect(recordAdventure(profile, run)).toBe(profile)
  })
  it('allows one loss, a first-loss boss retry, and ends on the second loss', () => {
    let run = lose(reduce(opened(5, 'loss'), { type: 'SIT' }))
    expect([run.losses, run.stage, run.table]).toEqual([1, 'seat', 0])
    run = lose(reduce(run, { type: 'SIT' }))
    expect([run.losses, run.stage]).toEqual([2, 'lost'])
    let boss = reduce({ ...opened(6, 'boss'), table: 3 }, { type: 'SIT' })
    boss = lose(boss)
    expect([boss.losses, boss.stage, boss.table]).toEqual([1, 'seat', 3])
    boss = reduce(boss, { type: 'SIT' })
    expect(boss.game.scores).toEqual({ human: 0, ai: 0 })
    expect(win(boss).stage).toBe('won')
    expect(lose(boss).stage).toBe('lost')
  })
  it('claims rewards into inventory once, rejects stale offers, and freezes equipped match snapshots', () => {
    const won = win(reduce(opened(1, 'loot'), { type: 'SIT' }))
    const run = { ...won, rewards: [{ id: 'charm', kind: 'modifier' as const, definitionId: 'lucky-charm' }] }
    expect(reduce(run, { type: 'REWARD', id: 'charm', offerId: 'old-offer' })).toBe(run)
    const pick = { type: 'REWARD' as const, id: 'charm', offerId: run.rewardOfferId! }
    const next = reduce(run, pick)
    expect(next.inventory.modifiers).toEqual(['core-steady', 'lucky-charm'])
    expect(next.modifiers).toEqual(['core-steady'])
    expect(next.game).toBe(run.game)
    expect(reduce(next, pick)).toBe(next)
    const equipped = reduce(next, { type: 'SIT', modifiers: ['lucky-charm'] })
    expect(equipped.game.config.modifierIds).toEqual(['lucky-charm'])
    expect(equipped.inventory.modifiers).toContain('core-steady')
    expect(reduce(equipped, { type: 'SIT', modifiers: [] })).toBe(equipped)
    const later = { ...run, rewardOfferId: 'later-offer' }
    expect(reduce(later, pick)).toBe(later)
    const dieRun = { ...run, rewards: [{ id: 'die', kind: 'die' as const, definitionId: 'joker' }] }
    const withDie = reduce(dieRun, { type: 'REWARD', id: 'die', offerId: run.rewardOfferId! })
    expect(withDie.inventory.dice.joker).toBe(1)
    expect(withDie.loadout).toEqual(run.loadout)
  })
  it('retains pending weighted rolls and the random stream after JSON restoration', () => {
    const run = reduce(reduce(opened(54321, 'resume'), { type: 'SIT' }), { type: 'ROLL' })
    const restored = normalizeAdventure(JSON.parse(JSON.stringify(run)))!
    expect(restored.pendingDice).toEqual(run.pendingDice)
    expect(restored.rng).toBe(run.rng)
    expect(reduce(restored, { type: 'ROLL_FINISHED' })).toEqual(reduce(run, { type: 'ROLL_FINISHED' }))
    expect(reduce(run, { type: 'ROLL' })).toBe(run)
  })
  it('preserves special dice across rerolls and restores a full seven-die hot hand', () => {
    let run = bare(88, 'hot')
    run = { ...run, modifiers: ['loaded-hand'], loadout: ['joker', ...Array<string>(5).fill('standard')], inventory: createInventory(['joker', ...Array<string>(5).fill('standard')], ['loaded-hand']) }
    run = reduce(run, { type: 'SIT' })
    run = selected(run, [1, 5])
    run.game.rolledDice[1] = { ...run.game.rolledDice[1], selected: false, definitionId: 'joker' }
    run = reduce(run, { type: 'ROLL' })
    expect(run.pendingDice.map((d) => d.definitionId)).toEqual(['joker'])
    expect(run.game.turnScore).toBe(100)
    run = reduce(selected(run, [1], 100), { type: 'ROLL' })
    expect(run.pendingDice).toHaveLength(7)
    expect(run.pendingDice[6].definitionId).toBe('standard')
    expect(run.game.turnScore).toBe(200)
  })
  it('does not let an illegal mixed selection bank or roll, and locks a doubled selection', () => {
    let run = selected(bare(7, 'bad'), [1, 2], 400)
    expect(reduce(run, { type: 'BANK' })).toBe(run)
    expect(reduce(run, { type: 'ROLL' })).toBe(run)
    run = { ...run, modifiers: ['double-down'], game: createInitialState({ ...run.game.config, modifierIds: ['double-down'] }) }
    run = selected(run, [1])
    run = reduce(run, { type: 'ABILITY', id: 'double-down' })
    expect(run.game.doubledSelection).toBe(true)
    expect(reduce(run, { type: 'TOGGLE', id: 'd0' }).game.rolledDice).toEqual(run.game.rolledDice)
    expect(reduce(run, { type: 'BANK' }).game.scores.human).toBe(200)
  })
  it('persists a consumed charm before reroll and only loses temporary points on a second bust', () => {
    let run = bare(7, 'charm')
    run = { ...run, modifiers: ['lucky-charm'], inventory: addInventoryItem(run.inventory, 'modifier', 'lucky-charm') }
    run = reduce(reduce(run, { type: 'SIT' }), { type: 'ROLL' })
    const rig = (r: AdventureRun): AdventureRun => ({ ...r, game: { ...r.game, turnScore: 600, scores: { human: 200, ai: 100 } },
      pendingDice: [2, 3].map((value, i) => ({ id: `b${i}`, definitionId: 'standard', value: value as 2 | 3, selected: false })), remainingLoadout: ['standard', 'standard'] })
    run = reduce(rig(run), { type: 'ROLL_FINISHED' })
    expect(run.flow).toBe('charm')
    expect(run.game.turnScore).toBe(600)
    expect(run.game.modifierUsage.turn['lucky-charm']).toBe(1)
    run = reduce(normalizeAdventure(JSON.parse(JSON.stringify(run)))!, { type: 'TICK' })
    run = reduce(rig(run), { type: 'ROLL_FINISHED' })
    expect(run.flow).toBe('bust')
    expect(run.game.turnScore).toBe(0)
    expect(run.game.scores.human).toBe(200)
  })
  it('rejects malformed and incompatible saves', () => {
    const run = createAdventure(1, 'save')
    for (const patch of [{ version: 3 }, { table: 5 }, { modifiers: ['unknown'] }, { rng: NaN }, { game: {} }, { stage: 'playing', flow: 'decide' }]) {
      expect(normalizeAdventure({ ...run, ...patch })).toBeNull()
    }
    expect(normalizeAdventure(run)).not.toBeNull()
  })
})
