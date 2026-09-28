import fallback from './fallback-trajectories.json'
import { cupMouth } from '../layout'
import type { PlayerId } from '../../game/types'
import type { PhysicsResponse, Trajectory } from './types'

export function fallbackTrajectory(count: number, player: PlayerId = 'human'): Trajectory {
  const trajectory = (fallback as unknown as Record<string, Trajectory>)[`${player}:${count}`]
  if (!trajectory) throw new Error('Unsupported dice count: ' + count)
  return trajectory
}

export class PhysicsClient {
  private worker?: Worker
  private nextId = 0
  private pending = new Map<number, (trajectory?: Trajectory) => void>()

  warm() {
    if (this.worker) return
    try {
      this.worker = new Worker(new URL('./physics.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (event: MessageEvent<PhysicsResponse>) => {
        this.pending.get(event.data.id)?.(event.data.trajectory)
      }
      this.worker.onerror = () => this.dispose()
      this.worker.postMessage({ id: -1, count: 1, seed: 1 })
    } catch { this.dispose() }
  }

  prepare(count: number, signal: AbortSignal, player: PlayerId = 'human'): Promise<Trajectory | null> {
    if (signal.aborted) return Promise.resolve(null)
    this.warm()
    if (!this.worker) return Promise.resolve(fallbackTrajectory(count, player))
    const id = ++this.nextId
    return new Promise((resolve) => {
      const finish = (trajectory?: Trajectory) => {
        if (!this.pending.has(id)) return
        this.pending.delete(id)
        window.clearTimeout(timeout)
        signal.removeEventListener('abort', abort)
        resolve(signal.aborted ? null : trajectory ?? fallbackTrajectory(count, player))
      }
      const abort = () => finish()
      const timeout = window.setTimeout(() => finish(), 700)
      this.pending.set(id, finish)
      signal.addEventListener('abort', abort, { once: true })
      try {
        const seed = crypto.getRandomValues(new Uint32Array(1))[0]
        this.worker!.postMessage({ id, count, seed, player, origin: cupMouth(player) })
      } catch { finish() }
    })
  }

  dispose() {
    this.worker?.terminate()
    this.worker = undefined
    for (const finish of [...this.pending.values()]) finish()
  }
}
