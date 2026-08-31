import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_SETTINGS } from '../game/rules'
import {
  AUDIO_KEY,
  loadAudioPreferences,
  loadSettings,
  loadStats,
  normalizeAudioPreferences,
  normalizeSettings,
  saveStored,
  SETTINGS_KEY,
  STATS_KEY,
} from './gameStorage'

class MemoryStorage {
  values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('game storage', () => {
  it('normalizes partial and invalid settings into a six-die loadout', () => {
    expect(normalizeSettings({
      targetScore: 1234,
      aiDifficulty: 'impossible',
      dieLoadout: ['joker', 'missing'],
      modifierIds: ['loaded-hand', 'missing', 'loaded-hand'],
    })).toEqual({
      ...DEFAULT_GAME_SETTINGS,
      dieLoadout: ['joker', 'standard', 'standard', 'standard', 'standard', 'standard'],
      modifierIds: ['loaded-hand'],
    })
  })

  it('falls back safely when stored JSON is corrupt', () => {
    const storage = new MemoryStorage()
    storage.values.set(SETTINGS_KEY, '{bad json')
    storage.values.set(STATS_KEY, JSON.stringify({ wins: -1, losses: 2.9, highestTurnScore: 'x' }))
    storage.values.set(AUDIO_KEY, JSON.stringify({ enabled: false, volume: 4 }))

    expect(loadSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS)
    expect(loadStats(storage)).toEqual({ wins: 0, losses: 2, highestTurnScore: 0, longestRollStreak: 0 })
    expect(loadAudioPreferences(storage)).toEqual({ enabled: false, volume: 1 })
  })

  it('clamps audio volume and handles storage write failures', () => {
    expect(normalizeAudioPreferences({ enabled: true, volume: -0.4 })).toEqual({ enabled: true, volume: 0 })
    const brokenStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('quota') },
    }
    expect(saveStored(brokenStorage, SETTINGS_KEY, {})).toBe(false)
    expect(saveStored(undefined, SETTINGS_KEY, {})).toBe(false)
  })
})
