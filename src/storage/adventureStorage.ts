import { ORIGINS, type AdventureRun } from '../game/adventure'
import { DIE_DEFINITIONS } from '../game/dice'
import { MODIFIERS } from '../game/modifiers'
import type { DieInstance, GameState } from '../game/types'
import { hasAnyScore, validateSelectedDice } from '../game/scoring'
import { getBrowserStorage, normalizeSettings, saveStored } from './gameStorage'
import { CORE_MODIFIERS } from '../game/cores'
import { isScoringVersion, LEGACY_SCORING_VERSION } from '../game/scoringVersions'
import { createInventory, ensureBaseDice, loadoutError, type Inventory } from '../game/inventory'

export const ADVENTURE_KEY = 'tavern-bones-adventure-v2'
export const LEGACY_ADVENTURE_KEY = 'tavern-bones-adventure-v1'
export const PROFILE_KEY = 'tavern-bones-profile-v1'
export const COMFORT_KEY = 'tavern-bones-comfort-v1'
export interface AdventureProfile { finishedIds: string[]; nights: number; wins: number; peak: number; memories: string[] }
export interface ComfortPreferences { fast: boolean; dialogue: boolean; environment: number; music: number; largeText: boolean; appearance: 'copper' | 'moon' }
export const DEFAULT_COMFORT: ComfortPreferences = { fast: false, dialogue: true, environment: 0.25, music: 0.15, largeText: false, appearance: 'copper' }
export const EMPTY_PROFILE: AdventureProfile = { finishedIds: [], nights: 0, wins: 0, peak: 0, memories: [] }

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void }
const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const number = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
const diceIds = new Set(DIE_DEFINITIONS.map((d) => d.id))
const modifierIds = new Set(MODIFIERS.map((m) => m.id))
const stringArray = (x: unknown, set?: Set<string>): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string' && (!set || set.has(v)))
const dice = (x: unknown): x is DieInstance[] => Array.isArray(x) && x.length <= 10000 && x.every((d) => record(d)
  && typeof d.id === 'string' && typeof d.definitionId === 'string' && diceIds.has(d.definitionId)
  && typeof d.selected === 'boolean' && ([1, 2, 3, 4, 5, 6].includes(d.value as number) || (d.value === 'JOKER' && d.definitionId === 'joker')))
const usage = (x: unknown) => record(x) && record(x.turn) && record(x.game)
  && [x.turn, x.game].every((map) => Object.entries(map).every(([key, value]) => modifierIds.has(key) && number(value)))

export function normalizeAdventure(value: unknown): AdventureRun | null {
  if (!record(value) || ![1, 2].includes(value.version as number) || typeof value.id !== 'string' || !value.id || value.id.length > 200) return null
  const legacy = value.version === 1
  const scoringVersion = legacy ? LEGACY_SCORING_VERSION : value.scoringVersion
  if (!isScoringVersion(scoringVersion)) return null
  if (!['revision', 'rng', 'rewardRng', 'table', 'losses', 'peak', 'largestBust'].every((key) => number(value[key]))) return null
  if ((value.table as number) > 3 || (value.losses as number) > 2 || !(value.rng as number) || (value.rng as number) > 0xffffffff
    || !(value.rewardRng as number) || (value.rewardRng as number) > 0xffffffff) return null
  if (!(legacy ? ['seat', 'playing', 'reward', 'won', 'lost'] : ['core', 'seat', 'playing', 'reward', 'won', 'lost']).includes(value.stage as string)
    || !['ready', 'rolling', 'selecting', 'inspect', 'decide', 'handoff', 'bust', 'charm', 'done'].includes(value.flow as string)) return null
  if (!stringArray(value.loadout, diceIds) || value.loadout.length !== 6 || !stringArray(value.modifiers, modifierIds)
    || value.modifiers.length > 2 || new Set(value.modifiers).size !== value.modifiers.length) return null
  let inventory: Inventory
  let opening: AdventureRun['opening']
  if (legacy) {
    if (value.modifiers.some((id) => CORE_MODIFIERS.some((m) => m.id === id))) return null
    inventory = createInventory(value.loadout, value.modifiers)
    opening = { offers: [], selected: null, source: 'migrated' }
  } else {
    const bag = value.inventory, start = value.opening
    const coreIds = new Set(CORE_MODIFIERS.map((m) => m.id))
    if (!record(bag) || !record(bag.dice)
      || !Object.entries(bag.dice).every(([id, n]) => diceIds.has(id) && number(n) && n > 0 && n <= 100)
      || !stringArray(bag.modifiers, modifierIds) || new Set(bag.modifiers).size !== bag.modifiers.length) return null
    if (!record(start) || !['new', 'migrated'].includes(start.source as string) || !stringArray(start.offers, coreIds)
      || new Set(start.offers).size !== start.offers.length || (start.selected !== null && (typeof start.selected !== 'string' || !coreIds.has(start.selected)))) return null
    if (start.source === 'new' && (start.offers.length !== 3 || (value.stage !== 'core' && start.selected === null)
      || (start.selected !== null && !bag.modifiers.includes(start.selected as string)))) return null
    if (start.source === 'migrated' && (start.offers.length || start.selected !== null || value.stage === 'core')) return null
    inventory = { dice: { ...bag.dice } as Record<string, number>, modifiers: [...bag.modifiers] }
    opening = { offers: [...start.offers], selected: start.selected as string | null, source: start.source as 'new' | 'migrated' }
    if (value.stage === 'core' && (start.selected !== null || value.table !== 0 || value.losses !== 0 || value.flow !== 'ready'
      || inventory.modifiers.length || value.modifiers.length)) return null
    if (value.stage === 'reward' ? typeof value.rewardOfferId !== 'string' || !value.rewardOfferId : value.rewardOfferId !== null) return null
  }
  inventory = ensureBaseDice(inventory)
  if (loadoutError(inventory, value.loadout, value.modifiers)) return null
  if (!dice(value.pendingDice) || value.pendingDice.length > 7 || !stringArray(value.remainingLoadout, diceIds) || value.remainingLoadout.length > 7) return null
  if (!Array.isArray(value.rewards) || value.rewards.length > 3 || !value.rewards.every((r) => record(r) && typeof r.id === 'string'
    && (r.kind === 'die' ? diceIds.has(r.definitionId as string) : r.kind === 'modifier' && modifierIds.has(r.definitionId as string)))) return null
  if (new Set(value.rewards.map((r) => r.id)).size !== value.rewards.length) return null
  if (!Array.isArray(value.history) || value.history.length > 5 || !value.history.every((h) => record(h) && number(h.table) && h.table <= 3
    && (h.winner === 'human' || h.winner === 'ai') && number(h.humanScore) && number(h.aiScore) && number(h.peak))) return null
  const history = value.history.map((h, i, all) => ({ ...h, attempt: all.slice(0, i).filter((prior) => prior.table === h.table).length + 1 }))
  if (!legacy && value.history.some((h, i) => h.attempt !== history[i].attempt)) return null
  const g = value.game
  if (!record(g) || !record(g.config) || !record(g.scores) || !number(g.scores.human) || !number(g.scores.ai)
    || (g.currentPlayer !== 'human' && g.currentPlayer !== 'ai') || !['ready', 'rolling', 'selecting', 'ai_thinking', 'bust', 'game_over'].includes(g.phase as string)
    || !['turnScore', 'diceToRoll', 'rollStreak', 'turnNumber'].every((key) => number(g[key])) || (g.diceToRoll as number) > 7
    || !dice(g.rolledDice) || g.rolledDice.length > 7 || !dice(g.lockedDice) || !usage(g.modifierUsage)
    || typeof g.message !== 'string' || typeof g.isHotDice !== 'boolean' || typeof g.doubledSelection !== 'boolean'
    || (g.winner !== undefined && g.winner !== 'human' && g.winner !== 'ai')) return null
  const config = normalizeSettings(g.config, 'adventure')
  if (config.targetScore !== g.config.targetScore || JSON.stringify(config.dieLoadout) !== JSON.stringify(g.config.dieLoadout)
    || JSON.stringify(config.modifierIds) !== JSON.stringify(g.config.modifierIds) || config.modifierIds.length > 2) return null
  if (!legacy && g.config.scoringVersion !== scoringVersion) return null
  if (config.modifierIds.filter((id) => CORE_MODIFIERS.some((m) => m.id === id)).length > 1) return null
  if (value.stage === 'playing') {
    if (JSON.stringify(config.dieLoadout) !== JSON.stringify(value.loadout) || JSON.stringify(config.modifierIds) !== JSON.stringify(value.modifiers)) return null
    const phases: Record<string, string> = { ready: 'ready', rolling: 'rolling', selecting: 'selecting', inspect: 'ai_thinking', decide: 'ai_thinking', handoff: 'ai_thinking', bust: 'bust', charm: 'bust' }
    if (phases[value.flow as string] !== g.phase || g.winner) return null
    if (['ready', 'selecting', 'charm'].includes(value.flow as string) && g.currentPlayer !== 'human') return null
    if (['inspect', 'decide'].includes(value.flow as string) && g.currentPlayer !== 'ai') return null
    if (value.flow === 'rolling' && (!value.pendingDice.length || value.pendingDice.length !== value.remainingLoadout.length
      || value.pendingDice.some((d, i) => d.definitionId !== (value.remainingLoadout as string[])[i]))) return null
    if (value.flow !== 'rolling' && value.pendingDice.length) return null
    if (value.flow === 'rolling' && value.pendingDice.some((d) => d.selected)) return null
    if (value.flow === 'decide' && !validateSelectedDice(g.rolledDice.filter((d) => d.selected).map((d) => d.value)).valid) return null
    if (['selecting', 'inspect'].includes(value.flow as string) && !hasAnyScore(g.rolledDice.map((d) => d.value))) return null
    if (value.flow === 'charm' && (!value.remainingLoadout.length || !config.modifierIds.includes('lucky-charm'))) return null
  }
  if (value.stage === 'reward' && (value.rewards.length !== 3 || value.table === 3 || g.winner !== 'human')) return null
  if (value.stage === 'won' && (value.table !== 3 || g.winner !== 'human' || value.losses === 2)) return null
  if (value.stage === 'lost' && value.losses !== 2) return null
  if (value.stage === 'core' && (value.history.length || value.pendingDice.length || g.phase !== 'ready' || g.winner)) return null
  // Reconstruct JSON-compatible fields and never trust persisted presentation events.
  return { ...value, version: 2, scoringVersion, inventory, opening, history,
    rewardOfferId: legacy ? value.stage === 'reward' ? `${value.id}:${value.table}:${value.history.length}` : null : value.rewardOfferId,
    game: { ...g, config: { ...config, scoringVersion } } as GameState, lastEvent: undefined } as unknown as AdventureRun
}

function read(key: string, storage: Storage | undefined): unknown {
  try { return JSON.parse(storage?.getItem(key) ?? 'null') } catch { return null }
}

export function loadAdventure(storage = getBrowserStorage()): AdventureRun | null {
  return readAdventure(storage).run
}

export interface AdventureRead { run: AdventureRun | null; warning: string; resumeRequired: boolean }
export function readAdventure(storage = getBrowserStorage()): AdventureRead {
  const failure = (warning: string): AdventureRead => ({ run: null, warning, resumeRequired: false })
  try {
    if (!storage) return failure('本机存储暂不可用。')
    const raw = storage.getItem(ADVENTURE_KEY)
    if (raw !== null) {
      const envelope: unknown = JSON.parse(raw)
      if (!record(envelope) || envelope.version !== 2 || !record(envelope.runtime) || typeof envelope.runtime.paused !== 'boolean'
        || !record(envelope.run) || envelope.run.version !== 2) return failure('冒险存档无法读取；可开始新的一夜或进入经典对局。')
      const run = normalizeAdventure(envelope.run)
      return run ? { run, warning: '', resumeRequired: run.stage === 'playing' } : failure('冒险存档无法读取；可开始新的一夜或进入经典对局。')
    }
    const old = storage.getItem(LEGACY_ADVENTURE_KEY)
    if (old === null) return failure('')
    const value: unknown = JSON.parse(old)
    const run = record(value) && value.version === 1 ? normalizeAdventure(value) : null
    if (!run) return failure('旧冒险存档无法读取；可开始新的一夜。')
    const saved = saveAdventure(run, storage, { paused: run.stage === 'playing' })
    return { run, warning: saved ? '' : '旧存档已载入，但迁移未能保存；请保持页面开启。', resumeRequired: run.stage === 'playing' }
  } catch { return failure('冒险存档无法读取；可开始新的一夜或进入经典对局。') }
}

export function loadProfile(storage = getBrowserStorage()): AdventureProfile {
  const value = read(PROFILE_KEY, storage)
  if (!record(value)) return { ...EMPTY_PROFILE, finishedIds: [], memories: [] }
  return { finishedIds: stringArray(value.finishedIds) ? value.finishedIds.slice(-256) : [], nights: number(value.nights) ? value.nights : 0,
    wins: number(value.wins) ? value.wins : 0, peak: number(value.peak) ? value.peak : 0,
    memories: stringArray(value.memories) ? [...new Set(value.memories)].filter((id) => ['mara', 'osric', 'rue', 'keeper'].includes(id)) : [] }
}

export function recordAdventure(profile: AdventureProfile, run: AdventureRun): AdventureProfile {
  if (!['won', 'lost'].includes(run.stage) || profile.finishedIds.includes(run.id)) return profile
  const ids = ['mara', 'osric', 'rue', 'keeper']
  return { finishedIds: [...profile.finishedIds, run.id].slice(-256), nights: profile.nights + 1,
    wins: profile.wins + Number(run.stage === 'won'), peak: Math.max(profile.peak, run.peak),
    memories: [...new Set([...profile.memories, ...run.history.map((h) => ids[h.table])])] }
}

export function unlockedOrigins(profile: AdventureProfile) {
  return ORIGINS.filter((o) => o.id === 'traveller' || (o.id === 'artisan' ? profile.nights > 0 : profile.wins > 0))
}

export function loadComfort(storage = getBrowserStorage()): ComfortPreferences {
  const value = read(COMFORT_KEY, storage)
  if (!record(value)) return { ...DEFAULT_COMFORT }
  const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback
  return { fast: value.fast === true, dialogue: value.dialogue !== false, environment: volume(value.environment, 0.25),
    music: volume(value.music, 0.15), largeText: value.largeText === true, appearance: value.appearance === 'moon' ? 'moon' : 'copper' }
}

export function saveAdventure(run: AdventureRun, storage = getBrowserStorage(), runtime = { paused: false }): boolean {
  return saveStored(storage, ADVENTURE_KEY, { version: 2, run, runtime: { paused: runtime.paused } })
}
