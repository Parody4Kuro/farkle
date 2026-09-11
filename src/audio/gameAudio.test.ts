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
  it('starts ambience only after unlock and stops scheduling when muted or disposed', async () => {
    vi.useFakeTimers()
    try {
      const context = createFakeContext()
      const factory = vi.fn(() => context)
      const tones = vi.spyOn(context, 'createOscillator')
      const audio = new WebGameAudio({ enabled: true, volume: 0.6 }, factory)
      audio.setAmbience(0.3, 0.2, 3)
      await vi.advanceTimersByTimeAsync(2000)
      expect(factory).not.toHaveBeenCalled()
      await audio.unlock()
      await vi.advanceTimersByTimeAsync(900)
      expect(tones).toHaveBeenCalled()
      audio.setEnabled(false)
      const count = tones.mock.calls.length
      await vi.advanceTimersByTimeAsync(3000)
      expect(tones.mock.calls.length).toBe(count)
      await audio.dispose()
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })

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
