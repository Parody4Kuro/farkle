import type { DieInstance, PlayerId } from '../game/types'
import { GamePlayback } from './GamePlayback'
import { ActionPlayback, actionForEvent } from './ActionPlayback'
import type { GameEvent } from '../game/state'
import type { GameState } from '../game/types'

export interface RollRequest {
  id: number
  dice: DieInstance[]
  player: PlayerId
  fast?: boolean
  onStart?: () => void
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
  readonly actions: ActionPlayback
  startedAt = -1
  private generation = 0
  private actionSequence = 0

  constructor(playback = new GamePlayback()) { this.playback = playback; this.actions = new ActionPlayback(playback) }

  animate(event: GameEvent, before: GameState, after: GameState) {
    const request = actionForEvent(`local:${this.generation}:${++this.actionSequence}`, event, before, after)
    if (request) this.actions.enqueue(request)
  }

  start(id: number) {
    if (this.current?.id !== id || this.startedAt >= 0) return
    this.startedAt = this.playback.now()
    this.current.onStart?.()
  }

  skip = () => {
    if (this.playback.paused) return
    this.actions.clear()
    this.finish()
  }

  reset = () => { this.generation++; this.actions.reset(); this.complete() }

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
    if (this.actions.busy) {
      const generation = this.generation
      return this.actions.wait(signal).then(() => {
        if (signal.aborted || generation !== this.generation) return
        return this.present(request, signal)
      })
    }
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
      this.startedAt = -1
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
    this.startedAt = -1
    resolve?.()
    this.publish()
  }
}
