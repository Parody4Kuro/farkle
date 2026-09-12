import { describe, expect, it } from 'vitest'
import { addInventoryItem, createInventory, createStartingInventory, ensureBaseDice, loadoutError } from './inventory'
import { adventureReducer as reduce, createAdventure, ORIGINS } from './adventure'

const six = Array<string>(6).fill('standard')

describe('owned inventory and equipment', () => {
  it.each(ORIGINS)('keeps six base dice available with the $id origin', ({ id, loadout }) => {
    const run = reduce(createAdventure(44, 'starting', id), { type: 'SELECT_CORE', id: 'core-steady' })
    expect(run.inventory.dice.standard).toBe(6)
    expect(run.loadout).toEqual(loadout)
    expect(loadoutError(run.inventory, six, run.modifiers)).toBeNull()
    expect(loadoutError(run.inventory, loadout, run.modifiers)).toBeNull()
    const entered = reduce(run, { type: 'SIT', loadout: six })
    expect(entered.game.config.dieLoadout).toEqual(six)
    expect(reduce(entered, { type: 'ROLL' }).pendingDice.map((die) => die.definitionId)).toEqual(six)
    expect(entered.inventory).toEqual(run.inventory)
  })

  it('keeps baseline ownership separate from equipment counting and temporary seventh dice', () => {
    const special = ['lucky-five', ...six.slice(1)]
    expect(createInventory(special).dice).toEqual({ 'lucky-five': 1, standard: 5 })
    const inventory = createStartingInventory(special, ['loaded-hand'])
    expect(inventory.dice).toEqual({ 'lucky-five': 1, standard: 6 })
    expect(ensureBaseDice(ensureBaseDice(inventory))).toEqual(inventory)
    let run = reduce(createAdventure(9, 'loaded'), { type: 'SELECT_CORE', id: 'core-steady' })
    run = { ...run, inventory }
    run = reduce(run, { type: 'SIT', modifiers: ['loaded-hand'], loadout: special })
    expect(reduce(run, { type: 'ROLL' }).pendingDice).toHaveLength(7)
    expect(run.inventory).toEqual(inventory)
  })
  it('counts identical rewards without discarding the dice they replace', () => {
    const initial = createInventory(six)
    const once = addInventoryItem(initial, 'die', 'joker')
    const twice = addInventoryItem(once, 'die', 'joker')
    expect(twice.dice).toEqual({ standard: 6, joker: 2 })
    expect(initial.dice).toEqual({ standard: 6 })
    expect(loadoutError(twice, ['joker', 'joker', ...six.slice(2)], [])).toBeNull()
    expect(loadoutError(once, ['joker', 'joker', ...six.slice(2)], [])).toMatch('数量')
    expect(loadoutError(twice, six, [])).toBeNull()
    expect(loadoutError(twice, [...six, 'joker'], [])).toMatch('六颗')
    expect(loadoutError(twice, ['__proto__', ...six.slice(1)], [])).not.toBeNull()
    expect(addInventoryItem(twice, 'die', 'unknown')).toBe(twice)
  })
  it('owns badges once and permits only two equipped badges and one core', () => {
    const bag = createInventory(six, ['core-steady', 'core-kindred', 'loaded-hand', 'golden-one'])
    expect(addInventoryItem(bag, 'modifier', 'golden-one')).toBe(bag)
    expect(loadoutError(bag, six, ['core-steady', 'loaded-hand'])).toBeNull()
    expect(loadoutError(bag, six, ['core-steady', 'core-kindred'])).toMatch('一枚核心')
    expect(loadoutError(bag, six, ['core-steady', 'golden-one', 'loaded-hand'])).toMatch('两枚')
    expect(loadoutError(bag, six, ['golden-one', 'golden-one'])).toMatch('不同徽章')
    expect(loadoutError(bag, six, ['double-down'])).toMatch('已有')
  })
  it('requires an opening choice, adds it exactly once, and validates entry atomically', () => {
    const start = createAdventure(44, 'opening')
    expect(start.stage).toBe('core')
    expect(reduce(start, { type: 'SIT' })).toBe(start)
    expect(reduce(start, { type: 'SELECT_CORE', id: 'golden-one' })).toBe(start)
    const choice = { type: 'SELECT_CORE' as const, id: 'core-kindred' }
    const prepared = reduce(start, choice)
    expect(prepared.modifiers).toEqual(['core-kindred'])
    expect(prepared.inventory.modifiers).toEqual(['core-kindred'])
    expect(prepared.rng).toBe(start.rng)
    expect(prepared.rewardRng).toBe(start.rewardRng)
    expect(reduce(prepared, choice)).toBe(prepared)
    expect(reduce(prepared, { type: 'SIT', loadout: ['joker', ...six.slice(1)] })).toBe(prepared)
    expect(reduce(prepared, { type: 'SIT', modifiers: ['golden-one'] })).toBe(prepared)
    const draft = ['standard', ...six.slice(1)]
    const entered = reduce(prepared, { type: 'SIT', loadout: draft, modifiers: [] })
    draft[0] = 'joker'
    expect(entered.loadout).toEqual(six)
    expect(entered.game.config.dieLoadout).toEqual(six)
    expect(entered.game.config.modifierIds).toEqual([])
    expect(entered.inventory.modifiers).toEqual(['core-kindred'])
    expect(reduce(entered, { type: 'SIT', modifiers: ['core-kindred'] })).toBe(entered)
  })
  it('keeps the same table, bag and random streams after the first loss and resets the retry duel', () => {
    let run = reduce(createAdventure(8, 'retry'), { type: 'SELECT_CORE', id: 'core-steady' })
    run = { ...run, inventory: addInventoryItem(run.inventory, 'modifier', 'golden-one') }
    run = reduce(run, { type: 'SIT', modifiers: ['golden-one'] })
    run = reduce(run, { type: 'ROLL' })
    const before = { ...run, pendingDice: [], flow: 'decide' as const, game: { ...run.game, phase: 'ai_thinking' as const,
      currentPlayer: 'ai' as const, turnScore: 2000, scores: { human: 1250, ai: 0 }, modifierUsage: { turn: {}, game: { 'golden-one': 1 } },
      rolledDice: [{ id: 'one', definitionId: 'standard', value: 1 as const, selected: true }] } }
    const lost = reduce(before, { type: 'TICK' })
    expect([lost.stage, lost.table, lost.losses, lost.rewards.length]).toEqual(['seat', 0, 1, 0])
    expect(lost.history[0]).toMatchObject({ table: 0, attempt: 1, winner: 'ai' })
    expect(lost.inventory).toEqual(before.inventory)
    expect([lost.rng, lost.rewardRng]).toEqual([before.rng, before.rewardRng])
    const retry = reduce(lost, { type: 'SIT', modifiers: ['core-steady', 'golden-one'] })
    expect(retry.game.scores).toEqual({ human: 0, ai: 0 })
    expect(retry.game.modifierUsage).toEqual({ turn: {}, game: {} })
    expect(retry.game.turnScore).toBe(0)
    expect(retry.history).toEqual(lost.history)
    expect(reduce(retry, { type: 'ROLL' }).rng).not.toBe(retry.rng)
    const twice = reduce({ ...retry, flow: before.flow, game: { ...before.game, config: retry.game.config } }, { type: 'TICK' })
    expect(twice.stage).toBe('lost')
    expect(twice.history.map((h) => h.attempt)).toEqual([1, 2])
  })
})
