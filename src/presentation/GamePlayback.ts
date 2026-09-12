export interface PlaybackSnapshot { active: boolean; paused: boolean; canResume: boolean; blockers: readonly string[] }

/** One active clock for a duel. Pausing preserves work; aborting discards it. */
export class GamePlayback {
  private active = false
  private waiting: boolean
  private blockers = new Set<string>()
  private listeners = new Set<() => void>()
  private cancellations = new Set<() => void>()
  private elapsed = 0
  private started = performance.now()
  private snapshot: PlaybackSnapshot

  constructor(paused = false) {
    this.waiting = paused
    this.snapshot = { active: false, paused, canResume: true, blockers: [] }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getSnapshot = () => this.snapshot
  now = () => this.elapsed + (this.snapshot.paused ? 0 : performance.now() - this.started)
  get paused() { return this.snapshot.paused }

  private publish() {
    const paused = this.waiting || this.blockers.size > 0
    const canResume = this.blockers.size === 0
    const blockers = [...this.blockers]
    if (this.snapshot.active === this.active && this.snapshot.paused === paused && this.snapshot.canResume === canResume
      && this.snapshot.blockers.join('|') === blockers.join('|')) return
    this.elapsed = this.now()
    this.started = performance.now()
    this.snapshot = { active: this.active, paused, canResume, blockers }
    for (const listener of [...this.listeners]) listener()
  }

  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    if (!active) this.waiting = false
    else if (this.blockers.size) this.waiting = true
    this.publish()
  }

  setBlocked(reason: string, blocked: boolean) {
    if (blocked) {
      this.blockers.add(reason)
      if (this.active) this.waiting = true
    } else this.blockers.delete(reason)
    this.publish()
  }

  pause = () => {
    if (!this.active) return
    this.waiting = true
    this.publish()
  }

  resume = (): boolean => {
    if (this.blockers.size) return false
    this.waiting = false
    this.publish()
    return true
  }

  /** Immediate completions (renderer failure, worker result) still wait for Continue. */
  whenRunning(callback: () => void, signal?: AbortSignal): () => void {
    if (signal?.aborted) return () => {}
    if (!this.paused) { callback(); return () => {} }
    let done = false
    const cancel = () => {
      if (done) return
      done = true
      unsubscribe()
      signal?.removeEventListener('abort', cancel)
      this.cancellations.delete(cancel)
    }
    const unsubscribe = this.subscribe(() => {
      if (this.paused || done) return
      cancel()
      callback()
    })
    signal?.addEventListener('abort', cancel, { once: true })
    this.cancellations.add(cancel)
    return cancel
  }

  schedule(callback: () => void, milliseconds: number, signal?: AbortSignal, onCancel?: () => void): () => void {
    if (signal?.aborted) { onCancel?.(); return () => {} }
    const deadline = this.now() + Math.max(0, milliseconds)
    let timer: ReturnType<typeof setTimeout> | undefined
    let done = false
    const cleanup = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      unsubscribe()
      signal?.removeEventListener('abort', cancel)
      this.cancellations.delete(cancel)
    }
    const cancel = () => { if (!done) { cleanup(); onCancel?.() } }
    const arm = () => {
      clearTimeout(timer)
      if (done || this.paused) return
      timer = setTimeout(() => {
        if (this.paused || done) return
        if (deadline - this.now() > 0.5) { arm(); return }
        cleanup()
        callback()
      }, Math.max(0, deadline - this.now()))
    }
    const unsubscribe = this.subscribe(arm)
    signal?.addEventListener('abort', cancel, { once: true })
    this.cancellations.add(cancel)
    arm()
    return cancel
  }

  wait(milliseconds: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => this.schedule(() => resolve(true), milliseconds, signal, () => resolve(false)))
  }

  cancelAll() {
    for (const cancel of [...this.cancellations]) cancel()
  }
}
