// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { adventureReducer, createAdventure, type AdventureRun } from '../game/adventure'
import { ADVENTURE_KEY, DEFAULT_COMFORT, normalizeAdventure } from '../storage/adventureStorage'
import type { GameAudio } from '../audio/gameAudio'
import type { RollRequest } from '../presentation/rollPresentation'
import { useAdventure } from './useAdventure'

afterEach(() => { vi.useRealTimers() })
function setup(run = createAdventure(9876543, 'hook')) {
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const audio: GameAudio = { unlock: vi.fn(async () => true), play: vi.fn(() => true), setEnabled: vi.fn(), setVolume: vi.fn(),
    suspend: vi.fn(async () => {}), dispose: vi.fn(async () => {}), getPreferences: () => ({ enabled: true, volume: .6 }) }
  let finish = () => {}
  const savedAtPresentation: string[] = []
  const present = vi.fn((_request: RollRequest, _signal: AbortSignal) => {
    savedAtPresentation.push(data.get(ADVENTURE_KEY) ?? '')
    return new Promise<void>((resolve) => { finish = resolve })
  })
  const hook = renderHook(() => useAdventure({ initial: run, comfort: DEFAULT_COMFORT, presentRoll: present, storage, audio }))
  return { ...hook, data, storage, audio, present, savedAtPresentation, finish: () => finish() }
}

it('saves a sampled result before presenting it and restores exactly that roll after unmount', async () => {
  const first = setup()
  act(() => first.result.current.act({ type: 'SIT' }))
  act(() => first.result.current.act({ type: 'ROLL' }))
  const persisted = normalizeAdventure(JSON.parse(first.data.get(ADVENTURE_KEY)!))!
  expect(persisted.flow).toBe('rolling')
  expect(persisted.pendingDice).toEqual(first.present.mock.calls[0][0].dice)
  expect(JSON.parse(first.savedAtPresentation[0]).pendingDice).toEqual(persisted.pendingDice)
  first.unmount()
})

it('does not let an old presenter write after leaving, and resumes a pending roll', async () => {
  const first = setup()
  act(() => first.result.current.act({ type: 'SIT' }))
  act(() => first.result.current.act({ type: 'ROLL' }))
  const saved = first.data.get(ADVENTURE_KEY)!
  const restored = normalizeAdventure(JSON.parse(saved))!
  first.unmount()
  await act(async () => first.finish())
  expect(first.data.get(ADVENTURE_KEY)).toBe(saved)
  const second = setup(restored)
  expect(second.result.current.run.pendingDice).toEqual(restored.pendingDice)
  await act(async () => second.finish())
  expect(second.result.current.run.pendingDice).toEqual([])
  expect(second.result.current.run.rng).toBe(restored.rng)
  second.unmount()
})

it('releases presentation timeouts without sampling a second result', async () => {
  vi.useFakeTimers()
  let initial = adventureReducer(createAdventure(89, 'timeout'), { type: 'SIT' })
  initial = adventureReducer(initial, { type: 'ROLL' })
  const hook = setup(initial)
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(hook.result.current.run.rng).toBe(initial.rng)
  expect(hook.result.current.run.game.rolledDice).toEqual(initial.pendingDice)
  hook.unmount()
})

it('resumes an interrupted AI decision and persists its bank once', async () => {
  vi.useFakeTimers()
  const base = adventureReducer(createAdventure(14, 'ai'), { type: 'SIT' })
  const initial: AdventureRun = { ...base, flow: 'decide', game: { ...base.game, currentPlayer: 'ai', phase: 'ai_thinking', turnScore: 400,
    rolledDice: [{ id: 'ai-one', definitionId: 'standard', value: 1, selected: true }, { id: 'ai-two', definitionId: 'standard', value: 2, selected: false }] } }
  const hook = setup(initial)
  await act(async () => { await vi.advanceTimersByTimeAsync(900) })
  expect(hook.result.current.run.game.scores.ai).toBe(500)
  await act(async () => { await vi.advanceTimersByTimeAsync(650) })
  expect(hook.result.current.run.flow).toBe('ready')
  expect(hook.result.current.run.game.scores.ai).toBe(500)
  hook.unmount()
})
