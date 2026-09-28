// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDiceGame } from './useDiceGame'
import { RollPresentation } from '../presentation/rollPresentation'
import type { GameAudio } from '../audio/gameAudio'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('banks once, freezes visual credit and handoff on pause, and cancels both on a new game', async () => {
  vi.useFakeTimers(); vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const presentation = new RollPresentation()
  const audio = { unlock: vi.fn().mockResolvedValue(true), play: vi.fn(), suspend: vi.fn(), dispose: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn() } as unknown as GameAudio
  const { result, unmount } = renderHook(() => useDiceGame({ presentation, playback: presentation.playback, audio, random: () => 0, storage: { getItem: () => null, setItem: () => {} } }))
  act(() => result.current.actions.startGame())
  await act(async () => result.current.actions.roll())
  await act(async () => { presentation.skip() })
  act(() => result.current.actions.toggleDie(result.current.state.rolledDice[0].id))
  act(() => { result.current.actions.bank(); result.current.actions.bank() })
  expect(result.current.state.scores.human).toBe(100)
  expect(presentation.actions.getSnapshot()?.before.rolledDice).toHaveLength(6)
  act(() => result.current.pause())
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(presentation.actions.busy).toBe(true)
  expect(presentation.getSnapshot()).toBeNull()
  act(() => result.current.actions.startGame())
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(presentation.actions.busy).toBe(false)
  expect(presentation.getSnapshot()).toBeNull()
  expect(result.current.state.scores.human).toBe(0)
  expect(result.current.state.currentPlayer).toBe('human')
  unmount()
})
