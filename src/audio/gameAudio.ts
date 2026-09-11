import type { AudioPreferences } from '../game/types'

export type SoundCue =
  | 'roll'
  | 'select'
  | 'lock'
  | 'bank'
  | 'bust'
  | 'hot-dice'
  | 'victory'
  | 'defeat'

export const SOUND_CUES: SoundCue[] = [
  'roll',
  'select',
  'lock',
  'bank',
  'bust',
  'hot-dice',
  'victory',
  'defeat',
]

type AudioContextFactory = () => AudioContext

function defaultContextFactory(): AudioContext {
  return new AudioContext()
}

export interface GameAudio {
  unlock(): Promise<boolean>
  play(cue: SoundCue): boolean
  playImpact?(strength: number): boolean
  setAmbience?(environment: number, music: number, tension: number): void
  setEnabled(enabled: boolean): void
  setVolume(volume: number): void
  suspend(): Promise<void>
  dispose(): Promise<void>
  getPreferences(): AudioPreferences
}

export class WebGameAudio implements GameAudio {
  private context?: AudioContext
  private master?: GainNode
  private lastImpact = -1
  private ambience = { environment: 0, music: 0, tension: 0 }
  private ambienceTimer?: ReturnType<typeof setInterval>
  private beat = 0
  private preferences: AudioPreferences
  private readonly createContext: AudioContextFactory

  constructor(preferences: AudioPreferences, createContext: AudioContextFactory = defaultContextFactory) {
    this.preferences = { ...preferences, volume: this.clampVolume(preferences.volume) }
    this.createContext = createContext
  }

  getPreferences(): AudioPreferences {
    return { ...this.preferences }
  }

  setEnabled(enabled: boolean): void {
    this.preferences.enabled = enabled
    if (!enabled) this.stopAmbience()
    if (this.context && this.master) this.master.gain.setTargetAtTime(enabled ? this.preferences.volume : 0, this.context.currentTime, 0.015)
    if (enabled) void this.unlock()
  }

  setVolume(volume: number): void {
    this.preferences.volume = this.clampVolume(volume)
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.preferences.enabled ? this.preferences.volume : 0, this.context.currentTime, 0.015)
    }
  }

  async unlock(): Promise<boolean> {
    if (!this.preferences.enabled) return false
    try {
      this.ensureContext()
      if (this.context?.state === 'suspended') await this.context.resume()
      if (this.context?.state === 'running') this.startAmbience()
      return this.context?.state === 'running'
    } catch {
      return false
    }
  }

  play(cue: SoundCue): boolean {
    if (!this.preferences.enabled) return false
    try {
      const context = this.ensureContext()
      if (context.state === 'suspended') void context.resume()
      this.renderCue(cue, context.currentTime + 0.01)
      return true
    } catch {
      return false
    }
  }

  playImpact(strength: number): boolean {
    // Collisions never create/unlock an AudioContext without a user gesture.
    if (!this.preferences.enabled || this.context?.state !== 'running') return false
    const now = this.context.currentTime
    if (now - this.lastImpact < 0.055) return false
    this.lastImpact = now
    const level = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 0))
    try {
      this.noise(now + 0.005, 0.045, 0.08 * level, 800)
      this.tone(now + 0.005, 160, 0.06, 0.07 * level, 'triangle', 80)
      return true
    } catch { return false }
  }

  async suspend(): Promise<void> {
    this.stopAmbience()
    try {
      if (this.context?.state === 'running') await this.context.suspend()
    } catch {
      // Sound is progressive enhancement; suspension errors are non-fatal.
    }
  }

  async dispose(): Promise<void> {
    this.stopAmbience()
    try {
      if (this.context && this.context.state !== 'closed') await this.context.close()
    } catch {
      // Ignore teardown failures from browser audio implementations.
    } finally {
      this.context = undefined
      this.master = undefined
    }
  }

  private clampVolume(volume: number): number {
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.6
  }

  setAmbience(environment: number, music: number, tension: number): void {
    this.ambience = { environment: this.clampVolume(environment), music: this.clampVolume(music), tension: Math.max(0, Math.min(4, tension)) }
    if (this.context?.state === 'running' && this.preferences.enabled) this.startAmbience()
    if (!environment && !music) this.stopAmbience()
  }

  private stopAmbience(): void {
    if (this.ambienceTimer !== undefined) clearInterval(this.ambienceTimer)
    this.ambienceTimer = undefined
  }

  private startAmbience(): void {
    if (this.ambienceTimer !== undefined || (!this.ambience.environment && !this.ambience.music)) return
    this.ambienceTimer = setInterval(() => {
      if (this.context?.state !== 'running' || !this.preferences.enabled) return
      try {
        const start = this.context.currentTime + 0.015
        const { environment, music, tension } = this.ambience
        if (environment && this.beat % 3 === 0) {
          this.noise(start, 2.9, environment * 0.16, 260) // hearth
          this.noise(start + 0.4, 0.15, environment * 0.07, 2200) // cloth / ember
        }
        if (environment && this.beat % 11 === 0) this.tone(start + 0.2, 1310, 0.35, environment * 0.045, 'sine') // glass
        if (music) {
          const notes = [146.83, 220, 293.66, 174.61, 196, 220, 261.63, 220]
          this.tone(start, notes[this.beat % notes.length], 0.7, music * 0.08, 'triangle')
          if (tension >= 2) this.tone(start + 0.45, notes[(this.beat + 2) % notes.length], 0.3, music * 0.05, 'triangle')
          if (tension >= 3) this.noise(start, 0.1, music * 0.1, 100)
        }
        this.beat++
      } catch { this.stopAmbience() }
    }, 900)
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = this.createContext()
      this.master = this.context.createGain()
      this.master.gain.value = this.preferences.volume
      this.master.connect(this.context.destination)
    }
    return this.context
  }

  private tone(
    start: number,
    frequency: number,
    duration: number,
    level: number,
    type: OscillatorType = 'sine',
    endFrequency?: number,
  ): void {
    if (!this.context || !this.master) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  private noise(start: number, duration: number, level: number, frequency: number): void {
    if (!this.context || !this.master) return
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration))
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < frameCount; index += 1) {
      const envelope = 1 - index / frameCount
      data[index] = (Math.random() * 2 - 1) * envelope
    }
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    const gain = this.context.createGain()
    source.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = 0.8
    gain.gain.setValueAtTime(level, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(start)
  }

  private renderCue(cue: SoundCue, start: number): void {
    switch (cue) {
      case 'roll':
        this.noise(start, 0.42, 0.18, 720)
        for (let index = 0; index < 6; index += 1) {
          const offset = index * 0.055 + Math.random() * 0.025
          this.tone(start + offset, 135 + Math.random() * 85, 0.055, 0.08, 'triangle', 90)
        }
        break
      case 'select':
        this.tone(start, 620, 0.045, 0.08, 'triangle', 410)
        break
      case 'lock':
        this.noise(start, 0.09, 0.11, 1100)
        this.tone(start, 240, 0.1, 0.08, 'triangle', 150)
        break
      case 'bank':
        this.tone(start, 740, 0.18, 0.09, 'sine')
        this.tone(start + 0.09, 990, 0.28, 0.08, 'sine')
        break
      case 'bust':
        this.noise(start, 0.28, 0.2, 180)
        this.tone(start, 180, 0.48, 0.14, 'sawtooth', 58)
        break
      case 'hot-dice':
        this.tone(start, 440, 0.2, 0.08, 'triangle')
        this.tone(start + 0.11, 660, 0.22, 0.08, 'triangle')
        this.tone(start + 0.22, 880, 0.34, 0.09, 'triangle')
        break
      case 'victory':
        this.tone(start, 392, 0.26, 0.08, 'triangle')
        this.tone(start + 0.13, 523.25, 0.28, 0.08, 'triangle')
        this.tone(start + 0.26, 659.25, 0.48, 0.1, 'triangle')
        break
      case 'defeat':
        this.tone(start, 329.63, 0.28, 0.08, 'triangle')
        this.tone(start + 0.16, 246.94, 0.3, 0.08, 'triangle')
        this.tone(start + 0.32, 174.61, 0.48, 0.09, 'triangle')
        break
    }
  }
}

export function createGameAudio(preferences: AudioPreferences): GameAudio {
  return new WebGameAudio(preferences)
}
