import { ORIGINS, type AdventureRun } from '../game/adventure'
import { DIE_DEFINITIONS } from '../game/dice'
import { MODIFIERS } from '../game/modifiers'
import type { DieInstance, GameState } from '../game/types'
import { hasAnyScore, validateSelectedDice } from '../game/scoring'
import { getBrowserStorage, normalizeSettings, saveStored } from './gameStorage'

export const ADVENTURE_KEY = 'tavern-bones-adventure-v1'
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
  if (!record(value) || value.version !== 1 || typeof value.id !== 'string' || !value.id || value.id.length > 200) return null
  if (!['revision', 'rng', 'rewardRng', 'table', 'losses', 'peak', 'largestBust'].every((key) => number(value[key]))) return null
  if ((value.table as number) > 3 || (value.losses as number) > 2 || !(value.rng as number) || (value.rng as number) > 0xffffffff
    || !(value.rewardRng as number) || (value.rewardRng as number) > 0xffffffff) return null
  if (!['seat', 'playing', 'reward', 'won', 'lost'].includes(value.stage as string)
    || !['ready', 'rolling', 'selecting', 'inspect', 'decide', 'handoff', 'bust', 'charm', 'done'].includes(value.flow as string)) return null
  if (!stringArray(value.loadout, diceIds) || value.loadout.length !== 6 || !stringArray(value.modifiers, modifierIds)
    || value.modifiers.length > 2 || new Set(value.modifiers).size !== value.modifiers.length) return null
  if (!dice(value.pendingDice) || value.pendingDice.length > 7 || !stringArray(value.remainingLoadout, diceIds) || value.remainingLoadout.length > 7) return null
  if (!Array.isArray(value.rewards) || value.rewards.length > 3 || !value.rewards.every((r) => record(r) && typeof r.id === 'string'
    && (r.kind === 'die' ? diceIds.has(r.definitionId as string) : r.kind === 'modifier' && modifierIds.has(r.definitionId as string)))) return null
  if (new Set(value.rewards.map((r) => r.id)).size !== value.rewards.length) return null
  if (!Array.isArray(value.history) || value.history.length > 5 || !value.history.every((h) => record(h) && number(h.table) && h.table <= 3
    && (h.winner === 'human' || h.winner === 'ai') && number(h.humanScore) && number(h.aiScore) && number(h.peak))) return null
  const g = value.game
  if (!record(g) || !record(g.config) || !record(g.scores) || !number(g.scores.human) || !number(g.scores.ai)
    || (g.currentPlayer !== 'human' && g.currentPlayer !== 'ai') || !['ready', 'rolling', 'selecting', 'ai_thinking', 'bust', 'game_over'].includes(g.phase as string)
    || !['turnScore', 'diceToRoll', 'rollStreak', 'turnNumber'].every((key) => number(g[key])) || (g.diceToRoll as number) > 7
    || !dice(g.rolledDice) || g.rolledDice.length > 7 || !dice(g.lockedDice) || !usage(g.modifierUsage)
    || typeof g.message !== 'string' || typeof g.isHotDice !== 'boolean' || typeof g.doubledSelection !== 'boolean'
    || (g.winner !== undefined && g.winner !== 'human' && g.winner !== 'ai')) return null
  const config = normalizeSettings(g.config)
  if (config.targetScore !== g.config.targetScore || JSON.stringify(config.dieLoadout) !== JSON.stringify(g.config.dieLoadout)
    || JSON.stringify(config.modifierIds) !== JSON.stringify(g.config.modifierIds) || config.modifierIds.length > 2) return null
  if (value.stage === 'playing') {
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
  // Reconstruct JSON-compatible fields and never trust persisted presentation events.
  return { ...value, game: { ...g, config } as GameState, lastEvent: undefined } as unknown as AdventureRun
}

function read(key: string, storage: Storage | undefined): unknown {
  try { return JSON.parse(storage?.getItem(key) ?? 'null') } catch { return null }
}

export function loadAdventure(storage = getBrowserStorage()): AdventureRun | null {
  return normalizeAdventure(read(ADVENTURE_KEY, storage))
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

export function saveAdventure(run: AdventureRun, storage = getBrowserStorage()): boolean {
  return saveStored(storage, ADVENTURE_KEY, run)
}
