// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameAudio } from '../audio/gameAudio'
import type { PresentRoll, RollRequest } from '../presentation/rollPresentation'
import { useDiceGame } from './useDiceGame'

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, 'hasFocus').mockReturnValue(true) })
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

  it('freezes the pending roll and timeout until manual resume, even if the presenter finishes while hidden', async () => {
    const { result, rolls, random, unmount } = setup()
    act(() => result.current.actions.roll())
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    const snapshot = result.current.state
    await act(async () => { rolls[0].resolve(); await vi.advanceTimersByTimeAsync(20000) })
    expect(result.current.paused).toBe(true)
    expect(result.current.state).toBe(snapshot)
    expect(rolls[0].signal.aborted).toBe(false)
    act(() => result.current.resume())
    expect(result.current.paused).toBe(true)
    hidden.mockReturnValue(false)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.paused).toBe(true)
    expect(result.current.state.phase).toBe('rolling')
    await act(async () => result.current.resume())
    expect(result.current.state.phase).toBe('selecting')
    expect(result.current.state.rolledDice).toEqual(rolls[0].request.dice)
    expect(random).toHaveBeenCalledTimes(6)
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

  it('freezes AI handoff and cues after native minimization until manual resume', async () => {
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
    expect(result.current.state.winner).toBeUndefined()
    expect(rolls).toHaveLength(1)
    act(() => { visible = true; for (const listener of listeners) listener() })
    await act(async () => vi.advanceTimersByTimeAsync(100))
    expect(rolls).toHaveLength(1)
    act(() => result.current.resume())
    await act(async () => vi.advanceTimersByTimeAsync(20))
    expect(rolls).toHaveLength(2)
    expect(audio.play).toHaveBeenCalledWith('roll')
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

  it('preserves Hot Dice delay and cancels a paused future roll when starting a new game', async () => {
    const { result, rolls, random, unmount } = setup()
    act(() => result.current.actions.roll())
    await act(async () => rolls[0].resolve())
    for (const die of result.current.state.rolledDice) act(() => result.current.actions.toggleDie(die.id))
    act(() => result.current.actions.roll())
    expect(result.current.state.isHotDice).toBe(true)
    const pot = result.current.state.turnScore
    await act(async () => vi.advanceTimersByTimeAsync(5))
    act(() => result.current.pause())
    await act(async () => vi.advanceTimersByTimeAsync(30000))
    expect(result.current.state.turnScore).toBe(pot)
    expect(random).toHaveBeenCalledTimes(6)
    act(() => result.current.resume())
    await act(async () => vi.advanceTimersByTimeAsync(14))
    expect(rolls).toHaveLength(1)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(rolls).toHaveLength(2)
    act(() => result.current.pause())
    act(() => result.current.actions.startGame())
    await act(async () => { rolls[1].resolve(); await vi.advanceTimersByTimeAsync(30000) })
    expect(result.current.state.phase).toBe('ready')
    expect(result.current.state.turnScore).toBe(0)
    expect(random).toHaveBeenCalledTimes(12)
    unmount()
  })

  it('retains AI inspection and skill usage while rules or settings cover the duel', async () => {
    const { result, rolls, unmount } = setup()
    act(() => result.current.actions.roll())
    await act(async () => rolls[0].resolve())
    act(() => result.current.actions.toggleDie(result.current.state.rolledDice[0].id))
    act(() => result.current.actions.bank())
    await act(async () => vi.advanceTimersByTimeAsync(20))
    await act(async () => rolls[1].resolve())
    await act(async () => vi.advanceTimersByTimeAsync(4))
    act(() => result.current.actions.setRulesOpen(true))
    const state = result.current.state
    await act(async () => vi.advanceTimersByTimeAsync(10000))
    expect(result.current.state).toBe(state)
    act(() => result.current.actions.setRulesOpen(false))
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(result.current.state).toBe(state)
    act(() => result.current.resume())
    await act(async () => vi.advanceTimersByTimeAsync(5))
    expect(result.current.state).toBe(state)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(result.current.state.rolledDice.every((d) => d.selected)).toBe(true)
    unmount()
  })
})
