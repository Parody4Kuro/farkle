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
})
