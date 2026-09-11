// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameAudio } from '../audio/gameAudio'
import type { PresentRoll, RollRequest } from '../presentation/rollPresentation'
import { useDiceGame } from './useDiceGame'

beforeEach(() => vi.useFakeTimers())
afterEach(() => { delete window.tavernDesktop; vi.useRealTimers(); vi.restoreAllMocks() })

function setup(random = vi.fn(() => 0), override?: PresentRoll) {
  const rolls: { request: RollRequest; signal: AbortSignal; resolve: () => void }[] = []
  const presentRoll: PresentRoll = override ?? ((request, signal) => new Promise((resolve) => {
    rolls.push({ request, signal, resolve })
  }))
  const audio: GameAudio = {
    unlock: vi.fn().mockResolvedValue(true), play: vi.fn(() => true), playImpact: vi.fn(() => true),
    setEnabled: vi.fn(), setVolume: vi.fn(), suspend: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined), getPreferences: () => ({ enabled: true, volume: 0.6 }),
  }
  let id = 0
  const dependencies = {
    presentRoll, random, idFactory: () => 'die-' + ++id, audio,
    storage: { getItem: () => null, setItem: () => {} },
    delays: { handoff: 20, aiInspect: 10, aiSelect: 10, aiDecision: 10, hotDice: 20, betweenRolls: 10, bust: 20 },
  }
  const hook = renderHook(() => useDiceGame(dependencies))
  act(() => hook.result.current.actions.startGame())
  return { ...hook, rolls, random, audio }
}

describe('physics presentation integration', () => {
  it('draws once, hides results until animation completes, then enables normal scoring', async () => {
    const { result, rolls, random, unmount } = setup()
    act(() => result.current.actions.roll())
    expect(random).toHaveBeenCalledTimes(6)
    expect(result.current.state.phase).toBe('rolling')
    expect(result.current.state.rolledDice).toEqual([])
    act(() => {
      result.current.actions.roll()
      result.current.actions.toggleDie(rolls[0].request.dice[0].id)
      result.current.actions.bank()
    })
    expect(rolls).toHaveLength(1)
    expect(random).toHaveBeenCalledTimes(6)
    await act(async () => rolls[0].resolve())
    expect(result.current.state.phase).toBe('selecting')
    expect(result.current.state.rolledDice).toEqual(rolls[0].request.dice)
    act(() => result.current.actions.toggleDie(result.current.state.rolledDice[0].id))
    act(() => result.current.actions.bank())
    expect(result.current.state.scores.human).toBe(100)
    unmount()
  })

  it('aborts stale animations on a new game and ignores their result and impact callbacks', async () => {
    const { result, rolls, audio, unmount } = setup()
    act(() => result.current.actions.roll())
    act(() => result.current.actions.startGame())
    expect(rolls[0].signal.aborted).toBe(true)
    await act(async () => {
      rolls[0].resolve()
      rolls[0].request.onImpact(1)
    })
    expect(result.current.state.phase).toBe('ready')
    expect(result.current.state.rolledDice).toEqual([])
    expect(audio.playImpact).not.toHaveBeenCalled()
    unmount()
  })

  it('aborts on unmount', async () => {
    const { result, rolls, unmount } = setup()
    act(() => result.current.actions.roll())
    unmount()
    expect(rolls[0].signal.aborted).toBe(true)
    await act(async () => rolls[0].resolve())
  })

  it('commits the original result after timeout without sampling again', async () => {
    const { result, rolls, random, unmount } = setup()
    act(() => result.current.actions.roll())
    await act(async () => vi.advanceTimersByTimeAsync(6000))
    expect(result.current.state.phase).toBe('selecting')
    expect(rolls[0].signal.aborted).toBe(true)
    expect(random).toHaveBeenCalledTimes(6)
    await act(async () => rolls[0].resolve())
    expect(result.current.state.rollStreak).toBe(1)
    unmount()
  })

  it('degrades silently when the presenter rejects', async () => {
    const { result, random, unmount } = setup(vi.fn(() => 0), () => Promise.reject(new Error('WebGL lost')))
    await act(async () => result.current.actions.roll())
    expect(result.current.state.phase).toBe('selecting')
    expect(random).toHaveBeenCalledTimes(6)
    unmount()
  })

  it('finishes the pending roll when the page is hidden', async () => {
    const { result, rolls, unmount } = setup()
    act(() => result.current.actions.roll())
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.state.phase).toBe('selecting')
    expect(rolls[0].signal.aborted).toBe(true)
    unmount()
  })

  it('uses the same presenter for AI turns', async () => {
    const { result, rolls, unmount } = setup()
    act(() => result.current.actions.roll())
    await act(async () => rolls[0].resolve())
    act(() => result.current.actions.toggleDie(result.current.state.rolledDice[0].id))
    act(() => result.current.actions.bank())
    await act(async () => vi.advanceTimersByTimeAsync(20))
    expect(rolls).toHaveLength(2)
    expect(rolls[1].request.player).toBe('ai')
    expect(result.current.state.phase).toBe('rolling')
    await act(async () => rolls[1].resolve())
    expect(result.current.state.phase).toBe('ai_thinking')
    unmount()
  })

  it('keeps background AI cues silent after native minimization', async () => {
    let visible = true
    const listeners = new Set<() => void>()
    window.tavernDesktop = {
      isVisible: () => visible,
      onVisibilityChange: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    const { result, rolls, audio, unmount } = setup()
    act(() => result.current.actions.roll())
    await act(async () => rolls[0].resolve())
    act(() => result.current.actions.toggleDie(result.current.state.rolledDice[0].id))
    act(() => result.current.actions.bank())
    vi.mocked(audio.play).mockClear()
    await act(async () => {
      visible = false
      for (const listener of listeners) listener()
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(audio.suspend).toHaveBeenCalledOnce()
    expect(result.current.state.winner).toBe('ai')
    expect(audio.play).not.toHaveBeenCalled()
    unmount()
    expect(listeners.size).toBe(0)
  })

  it('presents the protector reroll once and retains the original modifier rules', async () => {
    const outcomes = [0.2, 0.2, 0.4, 0.4, 0.55, 0.9]
    let index = 0
    const { result, rolls, random, unmount } = setup(vi.fn(() => outcomes[index++] ?? 0))
    act(() => result.current.actions.toggleModifier('lucky-charm'))
    act(() => result.current.actions.startGame())
    act(() => result.current.actions.roll())
    await act(async () => rolls[0].resolve())
    await act(async () => vi.advanceTimersByTimeAsync(20))
    expect(rolls).toHaveLength(2)
    expect(rolls[1].request.player).toBe('human')
    await act(async () => rolls[1].resolve())
    expect(random).toHaveBeenCalledTimes(12)
    expect(result.current.state.phase).toBe('selecting')
    expect(result.current.state.modifierUsage.turn['lucky-charm']).toBe(1)
    unmount()
  })
})
