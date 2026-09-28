import { afterEach, expect, it, vi } from 'vitest'
import { ActionPlayback, actionForEvent } from './ActionPlayback'
import { GamePlayback } from './GamePlayback'
import { createInitialState } from '../game/rules'
import { gameReducer } from '../game/state'

afterEach(() => vi.useRealTimers())
function setup() {
  vi.useFakeTimers()
  const clock = new GamePlayback(); clock.setActive(true)
  const player = new ActionPlayback(clock)
  const before = { ...createInitialState(), turnScore: 250 }
  const event = { type: 'BANK' as const, player: 'human' as const, turnTotal: 350, message: '', winningMessage: '' }
  const after = gameReducer(before, event)
  const request = actionForEvent('bank:1', event, before, after)!
  return { clock, player, before, after, request }
}
it('retains the departing dice and scores without mutating or awarding again', async () => {
  const { player, before, after, request } = setup()
  player.enqueue(request); before.turnScore = 999
  expect(player.getSnapshot()?.before.turnScore).toBe(250)
  expect(player.getSnapshot()?.after.scores.human).toBe(350)
  player.enqueue(request)
  await vi.advanceTimersByTimeAsync(1800)
  expect(player.busy).toBe(false)
  expect(after.scores.human).toBe(350)
})
it('pauses the action and its contact sound together, then finishes once', async () => {
  const { player, clock, request } = setup(); const cue = vi.fn()
  player.enqueue(request); player.cue(cue)
  await vi.advanceTimersByTimeAsync(400); clock.pause()
  await vi.advanceTimersByTimeAsync(30000)
  expect(cue).not.toHaveBeenCalled(); expect(player.busy).toBe(true)
  clock.resume(); await vi.advanceTimersByTimeAsync(1400)
  expect(cue).toHaveBeenCalledOnce(); expect(player.busy).toBe(false)
})
it('skip/reset releases waiters, cancels stale sounds and never runs an aborted continuation', async () => {
  const { player, request } = setup(); const cue = vi.fn(); const abort = new AbortController()
  player.enqueue(request); player.cue(cue)
  const pending = player.wait(abort.signal); abort.abort(); await pending
  expect(player.busy).toBe(true)
  const done = vi.fn(); const wait = player.wait().then(done)
  player.reset(); await wait; await vi.advanceTimersByTimeAsync(5000)
  expect(done).toHaveBeenCalledOnce(); expect(cue).not.toHaveBeenCalled()
})
it('reduced motion keeps a brief readable final transition and no queued backlog', async () => {
  const { player, request } = setup()
  player.configure({ fast: false, reducedMotion: true, cinematic: true, quality: 'auto' })
  player.enqueue(request); expect(player.getSnapshot()?.duration).toBe(100)
  await vi.advanceTimersByTimeAsync(100); expect(player.busy).toBe(false)
})
