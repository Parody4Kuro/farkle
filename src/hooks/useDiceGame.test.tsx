// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GameAudio, SoundCue } from '../audio/gameAudio'
import type { AudioPreferences } from '../game/types'
import { useDiceGame } from './useDiceGame'

class MemoryStorage {
  values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function createAudio(): GameAudio & {
  play: ReturnType<typeof vi.fn<(cue: SoundCue) => boolean>>
  setEnabled: ReturnType<typeof vi.fn<(enabled: boolean) => void>>
  setVolume: ReturnType<typeof vi.fn<(volume: number) => void>>
} {
  let preferences: AudioPreferences = { enabled: true, volume: 0.6 }
  const play = vi.fn((_cue: SoundCue) => true)
  const setEnabled = vi.fn((enabled: boolean) => { preferences = { ...preferences, enabled } })
  const setVolume = vi.fn((volume: number) => { preferences = { ...preferences, volume } })
  return {
    play,
    setEnabled,
    setVolume,
    unlock: vi.fn().mockResolvedValue(true),
    suspend: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    getPreferences: () => ({ ...preferences }),
  }
}

describe('useDiceGame integration', () => {
  it('keeps settings changes out of the active match snapshot', () => {
    const audio = createAudio()
    const { result, unmount } = renderHook(() => useDiceGame({ audio, storage: new MemoryStorage() }))

    act(() => result.current.actions.updateSettings({ targetScore: 2000 }))
    act(() => result.current.actions.startGame())
    expect(result.current.state.config.targetScore).toBe(2000)

    act(() => result.current.actions.updateSettings({ targetScore: 10000 }))
    expect(result.current.settings.targetScore).toBe(10000)
    expect(result.current.state.config.targetScore).toBe(2000)
    unmount()
  })

  it('routes player interactions to procedural sound cues', async () => {
    const audio = createAudio()
    let nextId = 0
    const dependencies = {
      audio,
      storage: new MemoryStorage(),
      random: () => 0,
      idFactory: () => `die-${nextId += 1}`,
      delays: { roll: 0, handoff: 10_000 },
    }
    const { result, unmount } = renderHook(() => useDiceGame(dependencies))

    act(() => result.current.actions.startGame())
    await act(async () => {
      result.current.actions.roll()
      await new Promise((resolve) => window.setTimeout(resolve, 5))
    })
    expect(result.current.state.phase).toBe('selecting')

    act(() => result.current.actions.toggleDie(result.current.state.rolledDice[0].id))
    act(() => result.current.actions.bank())

    expect(audio.play.mock.calls.flat()).toEqual(expect.arrayContaining(['roll', 'select', 'bank']))
    expect(result.current.state.scores.human).toBe(100)
    unmount()
  })

  it('applies mute and volume changes immediately', () => {
    const audio = createAudio()
    const { result, unmount } = renderHook(() => useDiceGame({ audio, storage: new MemoryStorage() }))

    act(() => result.current.actions.toggleAudio())
    expect(result.current.audioPreferences.enabled).toBe(false)
    expect(audio.setEnabled).toHaveBeenCalledWith(false)

    act(() => result.current.actions.setAudioVolume(0.35))
    expect(result.current.audioPreferences.volume).toBe(0.35)
    expect(audio.setVolume).toHaveBeenCalledWith(0.35)
    unmount()
  })
})
