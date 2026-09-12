import { DEFAULT_LOADOUT, DIE_DEFINITIONS } from '../game/dice'
import { MODIFIERS } from '../game/modifiers'
import { DEFAULT_GAME_SETTINGS, TARGET_SCORE_OPTIONS } from '../game/rules'
import type { AiDifficulty, AudioPreferences, GameSettings, GameStats } from '../game/types'

export const SETTINGS_KEY = 'tavern-bones-settings-v1'
export const STATS_KEY = 'tavern-bones-stats-v1'
export const AUDIO_KEY = 'tavern-bones-audio-v1'

export const DEFAULT_STATS: GameStats = {
  wins: 0,
  losses: 0,
  highestTurnScore: 0,
  longestRollStreak: 0,
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  enabled: true,
  volume: 0.6,
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStored(storage: StorageLike | undefined, key: string): unknown {
  try {
    const value = storage?.getItem(key)
    return value ? JSON.parse(value) : undefined
  } catch {
    return undefined
  }
}

export function getBrowserStorage(): StorageLike | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function normalizeSettings(value: unknown, mode: 'classic' | 'adventure' = 'classic'): GameSettings {
  if (!isRecord(value)) return {
    ...DEFAULT_GAME_SETTINGS,
    dieLoadout: [...DEFAULT_LOADOUT],
    modifierIds: [],
  }

  const validDice = new Set(DIE_DEFINITIONS.map((definition) => definition.id))
  const validModifiers = new Set(MODIFIERS.filter((modifier) => mode === 'adventure' || !modifier.adventureOnly).map((modifier) => modifier.id))
  const validDifficulties = new Set<AiDifficulty>(['conservative', 'normal', 'aggressive'])
  const storedLoadout = Array.isArray(value.dieLoadout) ? value.dieLoadout : []
  const storedModifiers = Array.isArray(value.modifierIds) ? value.modifierIds : []

  return {
    ...(value.scoringVersion === 1 ? { scoringVersion: 1 } : {}),
    targetScore: TARGET_SCORE_OPTIONS.includes(value.targetScore as typeof TARGET_SCORE_OPTIONS[number])
      ? value.targetScore as number
      : DEFAULT_GAME_SETTINGS.targetScore,
    aiDifficulty: validDifficulties.has(value.aiDifficulty as AiDifficulty)
      ? value.aiDifficulty as AiDifficulty
      : DEFAULT_GAME_SETTINGS.aiDifficulty,
    dieLoadout: Array.from({ length: 6 }, (_, index) => (
      typeof storedLoadout[index] === 'string' && validDice.has(storedLoadout[index] as string)
        ? storedLoadout[index] as string
        : DEFAULT_LOADOUT[index]
    )),
    modifierIds: [...new Set(storedModifiers.filter(
      (id): id is string => typeof id === 'string' && validModifiers.has(id),
    ))],
  }
}

function normalizeStat(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

export function normalizeStats(value: unknown): GameStats {
  if (!isRecord(value)) return { ...DEFAULT_STATS }
  return {
    wins: normalizeStat(value.wins),
    losses: normalizeStat(value.losses),
    highestTurnScore: normalizeStat(value.highestTurnScore),
    longestRollStreak: normalizeStat(value.longestRollStreak),
  }
}

export function normalizeAudioPreferences(value: unknown): AudioPreferences {
  if (!isRecord(value)) return { ...DEFAULT_AUDIO_PREFERENCES }
  const volume = typeof value.volume === 'number' && Number.isFinite(value.volume)
    ? Math.min(1, Math.max(0, value.volume))
    : DEFAULT_AUDIO_PREFERENCES.volume
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_AUDIO_PREFERENCES.enabled,
    volume,
  }
}

export function loadSettings(storage = getBrowserStorage()): GameSettings {
  return normalizeSettings(parseStored(storage, SETTINGS_KEY))
}

export function loadStats(storage = getBrowserStorage()): GameStats {
  return normalizeStats(parseStored(storage, STATS_KEY))
}

export function loadAudioPreferences(storage = getBrowserStorage()): AudioPreferences {
  return normalizeAudioPreferences(parseStored(storage, AUDIO_KEY))
}

export function saveStored(storage: StorageLike | undefined, key: string, value: unknown): boolean {
  try {
    storage?.setItem(key, JSON.stringify(value))
    return Boolean(storage)
  } catch {
    return false
  }
}
