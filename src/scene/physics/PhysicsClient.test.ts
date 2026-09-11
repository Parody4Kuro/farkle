// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhysicsClient, fallbackTrajectory } from './PhysicsClient'
import type { PhysicsResponse } from './types'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage?: (event: MessageEvent<PhysicsResponse>) => void
  onerror?: () => void
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('physics worker lifecycle', () => {
  it('uses a verified trajectory after the preparation budget expires', async () => {
    const client = new PhysicsClient()
    const pending = client.prepare(7, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(700)
    expect(await pending).toBe(fallbackTrajectory(7))
    expect(vi.getTimerCount()).toBe(0)
    client.dispose()
  })

  it('ignores stale replies and aborts promptly without killing a newer request', async () => {
    const client = new PhysicsClient()
    const controller = new AbortController()
    const old = client.prepare(2, controller.signal)
    const current = client.prepare(3, new AbortController().signal)
    const worker = FakeWorker.instances[0]
    controller.abort()
    expect(await old).toBeNull()
    worker.onmessage?.({ data: { id: 1, trajectory: fallbackTrajectory(2) } } as MessageEvent<PhysicsResponse>)
    const done = vi.fn()
    void current.then(done)
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    worker.onmessage?.({ data: { id: 2, trajectory: fallbackTrajectory(3) } } as MessageEvent<PhysicsResponse>)
    expect(await current).toBe(fallbackTrajectory(3))
    client.dispose()
  })

  it('releases pending work on worker errors and terminates its resources', async () => {
    const client = new PhysicsClient()
    const pending = client.prepare(6, new AbortController().signal)
    const worker = FakeWorker.instances[0]
    worker.onerror?.()
    expect(await pending).toBe(fallbackTrajectory(6))
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
