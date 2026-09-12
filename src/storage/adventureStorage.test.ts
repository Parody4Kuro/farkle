import { describe, expect, it } from 'vitest'
import { adventureReducer as reduce, createAdventure } from '../game/adventure'
import { ADVENTURE_KEY, LEGACY_ADVENTURE_KEY, normalizeAdventure, readAdventure, saveAdventure } from './adventureStorage'
import { evaluateSelection } from '../game/selection'
import { addInventoryItem } from '../game/inventory'

function storage() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}
function current() { return reduce(reduce(createAdventure(55, 'save'), { type: 'SELECT_CORE', id: 'core-steady' }), { type: 'SIT' }) }
function legacy() {
  const modern = reduce(current(), { type: 'ROLL' })
  // v1 never knew about a core or inventory; only its equipped items can migrate.
  return { ...modern, version: 1, inventory: undefined, scoringVersion: undefined, opening: undefined, rewardOfferId: undefined,
    modifiers: ['golden-one'], game: { ...modern.game, config: { ...modern.game.config, scoringVersion: undefined, modifierIds: ['golden-one'] } } }
}

describe('versioned adventure storage', () => {
  it('writes a runtime envelope and always requires a manual resume for restored duels', () => {
    const store = storage(), run = reduce(current(), { type: 'ROLL' })
    expect(saveAdventure(run, store, { paused: true })).toBe(true)
    const value = JSON.parse(store.data.get(ADVENTURE_KEY)!)
    expect(value.runtime).toEqual({ paused: true })
    const restored = readAdventure(store)
    expect(restored.resumeRequired).toBe(true)
    expect(restored.run?.pendingDice).toEqual(run.pendingDice)
    expect(restored.run?.rng).toBe(run.rng)
    expect(restored.run?.revision).toBe(run.revision)
    expect(restored.warning).toBe('')
    saveAdventure(run, store, { paused: false })
    expect(readAdventure(store).resumeRequired).toBe(true)
    saveAdventure(createAdventure(9, 'new'), store)
    expect(readAdventure(store).resumeRequired).toBe(false)
  })
  it('migrates the old snapshot without rerolling, reconstructing discarded loot or changing prior progress', () => {
    const store = storage(), old = legacy()
    const raw = JSON.stringify(old)
    store.setItem(LEGACY_ADVENTURE_KEY, raw)
    const result = readAdventure(store)
    expect(result.warning).toBe('')
    expect(result.run?.inventory).toEqual({ dice: { standard: 6 }, modifiers: ['golden-one'] })
    expect(result.run?.opening).toEqual({ source: 'migrated', offers: [], selected: null })
    expect(result.run?.pendingDice).toEqual(old.pendingDice)
    expect(result.run?.rng).toBe(old.rng)
    expect(result.run?.rewardRng).toBe(old.rewardRng)
    expect(store.getItem(LEGACY_ADVENTURE_KEY)).toBe(raw)
    expect(JSON.parse(store.getItem(ADVENTURE_KEY)!).version).toBe(2)
    const skipped = { ...old, stage: 'seat', flow: 'done', table: 1, losses: 1, pendingDice: [],
      history: [{ table: 0, winner: 'ai', humanScore: 1000, aiScore: 2050, peak: 400 }] }
    expect(normalizeAdventure(skipped)).toMatchObject({ table: 1, losses: 1, history: [{ table: 0, attempt: 1 }] })
  })
  it('preserves old reward choices, doubled selections, consumed abilities and AI decision snapshots', () => {
    const base = legacy()
    const dice = [{ id: 'one', definitionId: 'standard', value: 1, selected: true }]
    const game = { ...base.game, rolledDice: dice, doubledSelection: true, phase: 'selecting',
      config: { ...base.game.config, modifierIds: ['double-down'] }, modifierUsage: { turn: {}, game: { 'double-down': 1 } } }
    const selected = { ...base, modifiers: ['double-down'], flow: 'selecting', pendingDice: [], game }
    expect(normalizeAdventure(selected)?.game).toMatchObject({ doubledSelection: true, modifierUsage: game.modifierUsage })
    const ai = { ...selected, flow: 'decide', game: { ...game, currentPlayer: 'ai', phase: 'ai_thinking', doubledSelection: false } }
    expect(normalizeAdventure(ai)?.flow).toBe('decide')
    const reward = { ...base, stage: 'reward', flow: 'done', pendingDice: [],
      rewards: ['joker', 'lucky-one', 'lucky-five'].map((id) => ({ id: `die:${id}`, kind: 'die', definitionId: id })),
      game: { ...base.game, phase: 'game_over', winner: 'human' } }
    const migrated = normalizeAdventure(reward)!
    expect(migrated.rewards).toEqual(reward.rewards)
    expect(reduce(migrated, { type: 'REWARD', id: 'die:joker', offerId: migrated.rewardOfferId! }).inventory.dice.joker).toBe(1)
  })
  it('rejects corrupt v2 as the source of truth without falling back to v1', () => {
    const store = storage()
    store.setItem(LEGACY_ADVENTURE_KEY, JSON.stringify(legacy()))
    for (const invalid of ['{bad', 'null', JSON.stringify(current()), JSON.stringify({ version: 2, run: current(), runtime: {} })]) {
      store.setItem(ADVENTURE_KEY, invalid)
      expect(readAdventure(store).run).toBeNull()
      expect(readAdventure(store).warning).not.toBe('')
      expect(store.getItem(ADVENTURE_KEY)).toBe(invalid)
    }
  })
  it('rejects unowned equipment, impossible counts, unknown versions, multiple cores and mismatched frozen config', () => {
    const run = current()
    const patches = [
      { loadout: ['joker', ...run.loadout.slice(1)] },
      { inventory: { ...run.inventory, dice: { standard: -1 } } },
      { inventory: { ...run.inventory, dice: { standard: 6.5 } } },
      { inventory: { ...run.inventory, dice: { standard: 6, unknown: 1 } } },
      { scoringVersion: 999 },
      { scoringVersion: 1 },
      { game: { ...run.game, config: { ...run.game.config, scoringVersion: 999 } } },
      { modifiers: ['core-steady', 'core-kindred'], inventory: { ...run.inventory, modifiers: ['core-steady', 'core-kindred'] } },
      { modifiers: [] },
      { opening: { ...run.opening, selected: null } },
      { rewardOfferId: 'stale' },
    ]
    for (const patch of patches) expect(normalizeAdventure({ ...run, ...patch })).toBeNull()
  })

  it('tops up v1 and v2 base dice idempotently while preserving special equipment and progress', () => {
    const modern = current()
    const loadout = ['lucky-five', ...Array<string>(5).fill('standard')]
    const short = { ...modern, loadout, inventory: { ...modern.inventory, dice: { standard: 5, 'lucky-five': 1 } },
      game: { ...modern.game, scores: { human: 700, ai: 450 }, config: { ...modern.game.config, dieLoadout: loadout } } }
    const old = { ...short, version: 1, inventory: undefined, scoringVersion: undefined, modifiers: [],
      game: { ...short.game, config: { ...short.game.config, modifierIds: [], scoringVersion: undefined } } }
    for (const source of [short, old]) {
      const result = normalizeAdventure(JSON.parse(JSON.stringify(source)))!
      expect(result.inventory.dice).toEqual({ standard: 6, 'lucky-five': 1 })
      expect(result.loadout).toEqual(loadout)
      expect(result.game.config.dieLoadout).toEqual(loadout)
      expect(result.game.scores).toEqual(short.game.scores)
      expect([result.table, result.rng, result.rewardRng, result.pendingDice]).toEqual([source.table, source.rng, source.rewardRng, source.pendingDice])
      const store = storage()
      saveAdventure(result, store)
      const again = readAdventure(store).run!
      expect(again).toEqual(result)
      expect(normalizeAdventure(again)).toEqual(result)
    }
    expect(normalizeAdventure({ ...short, inventory: { ...short.inventory, dice: { 'lucky-five': 1 } } })?.inventory.dice.standard).toBe(6)
    expect(normalizeAdventure({ ...short, inventory: { ...short.inventory, dice: { standard: 5 } } })).toBeNull()
    expect(short.inventory.dice.standard).toBe(5)
  })

  it.each([1, 2] as const)('preserves scoring version %i through resume, double down, bank and the next table', (version) => {
    let run = current()
    run = { ...run, scoringVersion: version, modifiers: ['core-steady', 'double-down'],
      inventory: addInventoryItem(run.inventory, 'modifier', 'double-down'), flow: 'selecting',
      game: { ...run.game, phase: 'selecting', turnScore: 1500, config: { ...run.game.config, scoringVersion: version, modifierIds: ['core-steady', 'double-down'] },
        rolledDice: [0, 1, 2].map((i) => ({ id: `one${i}`, definitionId: 'standard', value: 1, selected: true })) } }
    const store = storage()
    const doubled = reduce(run, { type: 'ABILITY', id: 'double-down' })
    saveAdventure(doubled, store)
    const restored = readAdventure(store).run!
    const points = version === 1 ? 1200 : 1000
    expect(evaluateSelection(restored.game).score).toBe(points)
    expect(restored.game.doubledSelection).toBe(true)
    expect(restored.game.modifierUsage).toEqual(doubled.game.modifierUsage)
    const won = reduce(restored, { type: 'BANK' })
    expect(won.game.scores.human).toBe(1500 + points)
    expect(won.stage).toBe('reward')
    const next = reduce(reduce(won, { type: 'SKIP_REWARD', offerId: won.rewardOfferId! }), { type: 'SIT' })
    expect(next.scoringVersion).toBe(version)
    expect(next.game.config.scoringVersion).toBe(version)
    expect(normalizeAdventure(next)?.game.config.scoringVersion).toBe(version)
    expect(createAdventure(9, 'fresh').scoringVersion).toBe(2)
  })
  it('keeps a migrated run playable when writes fail, and handles denied reads', () => {
    const raw = JSON.stringify(legacy())
    const result = readAdventure({ getItem: (key) => key === LEGACY_ADVENTURE_KEY ? raw : null, setItem: () => { throw new Error('quota') } })
    expect(result.run?.id).toBe('save')
    expect(result.warning).toMatch('迁移未能保存')
    expect(readAdventure({ getItem: () => { throw new Error('denied') }, setItem: () => {} }).run).toBeNull()
  })
})
