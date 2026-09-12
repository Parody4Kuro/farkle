import { describe, expect, it } from 'vitest'
import { adventureReducer as reduce, createAdventure } from '../game/adventure'
import { ADVENTURE_KEY, LEGACY_ADVENTURE_KEY, normalizeAdventure, readAdventure, saveAdventure } from './adventureStorage'

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
      { inventory: { ...run.inventory, dice: { standard: 5 } } },
      { inventory: { ...run.inventory, dice: { standard: -1 } } },
      { inventory: { ...run.inventory, dice: { standard: 6.5 } } },
      { inventory: { ...run.inventory, dice: { standard: 6, unknown: 1 } } },
      { scoringVersion: 999 },
      { modifiers: ['core-steady', 'core-kindred'], inventory: { ...run.inventory, modifiers: ['core-steady', 'core-kindred'] } },
      { modifiers: [] },
      { opening: { ...run.opening, selected: null } },
      { rewardOfferId: 'stale' },
    ]
    for (const patch of patches) expect(normalizeAdventure({ ...run, ...patch })).toBeNull()
  })
  it('keeps a migrated run playable when writes fail, and handles denied reads', () => {
    const raw = JSON.stringify(legacy())
    const result = readAdventure({ getItem: (key) => key === LEGACY_ADVENTURE_KEY ? raw : null, setItem: () => { throw new Error('quota') } })
    expect(result.run?.id).toBe('save')
    expect(result.warning).toMatch('迁移未能保存')
    expect(readAdventure({ getItem: () => { throw new Error('denied') }, setItem: () => {} }).run).toBeNull()
  })
})
