import type { DieInstance, PlayerId } from '../game/types'
import { GamePlayback } from './GamePlayback'

export interface RollRequest {
  id: number
  dice: DieInstance[]
  player: PlayerId
  fast?: boolean
  onImpact: (strength: number) => void
}

export type PresentRoll = (request: RollRequest, signal: AbortSignal) => Promise<void>

/** A small rendezvous between game orchestration and the optional renderer. */
export class RollPresentation {
  private current: RollRequest | null = null
  private listeners = new Set<() => void>()
  private resolve?: () => void
  private ready = false
  private cancelFinish = () => {}
  readonly playback: GamePlayback

  constructor(playback = new GamePlayback()) { this.playback = playback }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = () => this.current

  setReady(ready: boolean) {
    this.ready = ready
    if (!ready) this.finish()
  }

  private publish() {
    this.listeners.forEach((listener) => listener())
  }

  present: PresentRoll = (request, signal) => {
    this.complete()
    if (signal.aborted) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const cancelTimeout = this.playback.schedule(() => this.finish(request.id), this.ready ? 5500 : 650)
      const onAbort = () => this.complete(request.id)
      this.resolve = () => {
        cancelTimeout()
        signal.removeEventListener('abort', onAbort)
        resolve()
      }
      signal.addEventListener('abort', onAbort, { once: true })
      this.current = request
      this.publish()
    })
  }

  finish(id?: number) {
    if (id !== undefined && this.current?.id !== id) return
    if (!this.current) return
    const currentId = this.current.id
    this.cancelFinish()
    this.cancelFinish = this.playback.whenRunning(() => this.complete(currentId))
  }

  private complete(id?: number) {
    if (id !== undefined && this.current?.id !== id) return
    this.cancelFinish()
    this.cancelFinish = () => {}
    const resolve = this.resolve
    this.resolve = undefined
    this.current = null
    resolve?.()
    this.publish()
  }
}
