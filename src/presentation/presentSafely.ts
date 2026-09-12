import type { GamePlayback } from './GamePlayback'
import type { PresentRoll, RollRequest } from './rollPresentation'

/** The renderer and its timeout share a pause budget. Abort releases only cancelled work. */
export function presentSafely(playback: GamePlayback, present: PresentRoll | undefined, request: RollRequest,
  signal: AbortSignal, fallbackDelay = 650): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    let done = false
    let requested = false
    let cancelGate = () => {}
    const finish = () => {
      if (done) return
      done = true
      cancelTimer(); cancelGate()
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const completed = () => {
      if (requested || done) return
      requested = true
      cancelGate = playback.whenRunning(finish, signal)
    }
    const cancelTimer = playback.schedule(completed, present ? 6000 : fallbackDelay, signal)
    signal.addEventListener('abort', finish, { once: true })
    if (!present) return
    try { void present(request, signal).then(completed, completed) }
    catch { completed() }
  })
}
