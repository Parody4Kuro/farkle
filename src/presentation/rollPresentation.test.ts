// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RollPresentation, type RollRequest } from './rollPresentation'

const request = (id: number): RollRequest => ({
  id, player: 'human', dice: [{ id: 'die', definitionId: 'standard', value: 1, selected: false }], onImpact: vi.fn(),
})
afterEach(() => vi.useRealTimers())

describe('renderer rendezvous', () => {
  it('waits for the matching roll and ignores stale or duplicate completion', async () => {
    const presentation = new RollPresentation()
    presentation.setReady(true)
    const done = vi.fn()
    const pending = presentation.present(request(2), new AbortController().signal).then(done)
    presentation.finish(1)
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    presentation.finish(2)
    presentation.finish(2)
    await pending
    expect(done).toHaveBeenCalledOnce()
    expect(presentation.getSnapshot()).toBeNull()
  })

  it('cancels promptly and does not let an old abort clear a newer roll', async () => {
    const presentation = new RollPresentation()
    presentation.setReady(true)
    const old = new AbortController()
    const first = presentation.present(request(1), old.signal)
    const next = new AbortController()
    const second = presentation.present(request(2), next.signal)
    old.abort()
    await first
    expect(presentation.getSnapshot()?.id).toBe(2)
    next.abort()
    await second
    expect(presentation.getSnapshot()).toBeNull()
  })

  it('continues when the renderer is absent, fails, or never completes', async () => {
    vi.useFakeTimers()
    const presentation = new RollPresentation()
    const withoutRenderer = presentation.present(request(1), new AbortController().signal)
    await vi.advanceTimersByTimeAsync(650)
    await withoutRenderer
    presentation.setReady(true)
    const failed = presentation.present(request(2), new AbortController().signal)
    presentation.setReady(false)
    await failed
    presentation.setReady(true)
    const stalled = presentation.present(request(3), new AbortController().signal)
    await vi.advanceTimersByTimeAsync(5500)
    await stalled
    expect(presentation.getSnapshot()).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains request identity and timeout budget while paused, including renderer failure', async () => {
    vi.useFakeTimers()
    const presentation = new RollPresentation()
    presentation.playback.setActive(true)
    const done = vi.fn(), roll = request(4)
    const pending = presentation.present(roll, new AbortController().signal).then(done)
    await vi.advanceTimersByTimeAsync(200)
    presentation.playback.pause()
    await vi.advanceTimersByTimeAsync(20000)
    expect(presentation.getSnapshot()).toBe(roll)
    expect(done).not.toHaveBeenCalled()
    presentation.playback.resume()
    await vi.advanceTimersByTimeAsync(449)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(done).toHaveBeenCalledOnce()
    presentation.setReady(true)
    const next = request(5)
    const failed = presentation.present(next, new AbortController().signal)
    presentation.playback.pause()
    presentation.setReady(false)
    expect(presentation.getSnapshot()).toBe(next)
    presentation.playback.resume()
    await failed
    expect(presentation.getSnapshot()).toBeNull()
  })

  it('aborts a paused failed renderer promptly without releasing a future request', async () => {
    const presentation = new RollPresentation()
    presentation.playback.setActive(true)
    const abort = new AbortController()
    const old = presentation.present(request(9), abort.signal)
    presentation.playback.pause()
    presentation.finish(9)
    abort.abort()
    await old
    const nextAbort = new AbortController()
    const next = presentation.present(request(10), nextAbort.signal)
    presentation.playback.resume()
    expect(presentation.getSnapshot()?.id).toBe(10)
    nextAbort.abort()
    await next
  })
})
