import { describe, expect, it, vi } from 'vitest'
import { SOUND_CUES, WebGameAudio } from './gameAudio'

function createFakeContext(): AudioContext {
  const audioParam = {
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
  const node = () => ({ connect: vi.fn() })
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 1000,
    destination: node(),
    createGain: () => ({ ...node(), gain: { ...audioParam } }),
    createOscillator: () => ({
      ...node(),
      type: 'sine',
      frequency: { ...audioParam },
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBuffer: (_channels: number, frameCount: number) => ({
      getChannelData: () => new Float32Array(frameCount),
    }),
    createBufferSource: () => ({ ...node(), buffer: null, start: vi.fn() }),
    createBiquadFilter: () => ({
      ...node(),
      type: 'bandpass',
      frequency: { value: 0 },
      Q: { value: 0 },
    }),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AudioContext
}

describe('WebGameAudio', () => {
  it('is lazy and silent while disabled', async () => {
    const factory = vi.fn(() => createFakeContext())
    const audio = new WebGameAudio({ enabled: false, volume: 0.6 }, factory)

    expect(audio.play('roll')).toBe(false)
    expect(await audio.unlock()).toBe(false)
    expect(factory).not.toHaveBeenCalled()
  })

  it('renders every event cue through one reusable context', async () => {
    const factory = vi.fn(() => createFakeContext())
    const audio = new WebGameAudio({ enabled: true, volume: 0.6 }, factory)

    expect(await audio.unlock()).toBe(true)
    for (const cue of SOUND_CUES) expect(audio.play(cue)).toBe(true)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('clamps volume and degrades safely if Web Audio is unavailable', () => {
    const unavailable = new WebGameAudio({ enabled: true, volume: 2 }, () => { throw new Error('unsupported') })
    expect(unavailable.getPreferences().volume).toBe(1)
    expect(unavailable.play('select')).toBe(false)

    unavailable.setVolume(Number.NaN)
    expect(unavailable.getPreferences().volume).toBe(0.6)
  })
})
