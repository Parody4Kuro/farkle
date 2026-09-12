// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { adventureReducer, createAdventure, type AdventureRun } from '../game/adventure'
import { ADVENTURE_KEY, DEFAULT_COMFORT, normalizeAdventure } from '../storage/adventureStorage'
import type { GameAudio } from '../audio/gameAudio'
import type { RollRequest } from '../presentation/rollPresentation'
import { useAdventure } from './useAdventure'

beforeEach(() => { vi.spyOn(document, 'hasFocus').mockReturnValue(true) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete window.tavernDesktop })
function opened(seed: number, id: string) { return adventureReducer(createAdventure(seed, id), { type: 'SELECT_CORE', id: 'core-steady' }) }
function setup(run = opened(9876543, 'hook'), resumeRequired = false) {
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
  const hook = renderHook(() => useAdventure({ initial: run, resumeRequired, comfort: DEFAULT_COMFORT, presentRoll: present, storage, audio }))
  return { ...hook, data, storage, audio, present, savedAtPresentation, finish: () => finish() }
}

it('saves a sampled result before presenting it and restores exactly that roll after unmount', async () => {
  const first = setup()
  act(() => first.result.current.act({ type: 'SIT' }))
  act(() => first.result.current.act({ type: 'ROLL' }))
  const persisted = normalizeAdventure(JSON.parse(first.data.get(ADVENTURE_KEY)!).run)!
  expect(persisted.flow).toBe('rolling')
  expect(persisted.pendingDice).toEqual(first.present.mock.calls[0][0].dice)
  expect(JSON.parse(first.savedAtPresentation[0]).run.pendingDice).toEqual(persisted.pendingDice)
  first.unmount()
})

it('does not let an old presenter write after leaving, and resumes a pending roll', async () => {
  const first = setup()
  act(() => first.result.current.act({ type: 'SIT' }))
  act(() => first.result.current.act({ type: 'ROLL' }))
  const saved = first.data.get(ADVENTURE_KEY)!
  const restored = normalizeAdventure(JSON.parse(saved).run)!
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
  let initial = adventureReducer(opened(89, 'timeout'), { type: 'SIT' })
  initial = adventureReducer(initial, { type: 'ROLL' })
  const hook = setup(initial)
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(hook.result.current.run.rng).toBe(initial.rng)
  expect(hook.result.current.run.game.rolledDice).toEqual(initial.pendingDice)
  hook.unmount()
})

it('resumes an interrupted AI decision and persists its bank once', async () => {
  vi.useFakeTimers()
  const base = adventureReducer(opened(14, 'ai'), { type: 'SIT' })
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

it.each(['inspect', 'decide', 'handoff', 'bust', 'charm'] as const)('freezes %s at its remaining delay and resumes exactly once', async (flow) => {
  vi.useFakeTimers()
  const base = adventureReducer(opened(14, `pause-${flow}`), { type: 'SIT' })
  const human = ['handoff', 'bust', 'charm'].includes(flow)
  const initial: AdventureRun = { ...base, flow, remainingLoadout: ['standard', 'standard'],
    game: { ...base.game, currentPlayer: human ? 'human' : 'ai', phase: ['bust', 'charm'].includes(flow) ? 'bust' : 'ai_thinking',
      turnScore: flow === 'decide' ? 400 : 0,
      rolledDice: [{ id: 'one', definitionId: 'standard', value: 1, selected: flow === 'decide' },
        { id: 'two', definitionId: 'standard', value: 2, selected: false }] } }
  const duration = flow === 'bust' || flow === 'charm' ? 1200 : flow === 'decide' ? 900 : 650
  const hook = setup(initial)
  await act(async () => vi.advanceTimersByTimeAsync(250))
  act(() => window.dispatchEvent(new Event('blur')))
  const saved = JSON.parse(hook.data.get(ADVENTURE_KEY)!)
  expect(saved.runtime.paused).toBe(true)
  expect(saved.run.revision).toBe(initial.revision)
  await act(async () => vi.advanceTimersByTimeAsync(60000))
  expect(hook.result.current.run).toBe(initial)
  act(() => window.dispatchEvent(new Event('focus')))
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(hook.result.current.run).toBe(initial)
  act(() => hook.result.current.resume())
  await act(async () => vi.advanceTimersByTimeAsync(duration - 251))
  expect(hook.result.current.run).toBe(initial)
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(hook.result.current.run).toEqual(adventureReducer(initial, { type: 'TICK' }))
  hook.unmount()
})

it('keeps a restored pending roll paused through completion and commits its original values only on Continue', async () => {
  vi.useFakeTimers()
  const initial = adventureReducer(adventureReducer(opened(99, 'paused-load'), { type: 'SIT' }), { type: 'ROLL' })
  const hook = setup(initial, true)
  expect(hook.result.current.paused).toBe(true)
  await act(async () => { hook.finish(); await vi.advanceTimersByTimeAsync(30000) })
  expect(hook.result.current.run).toBe(initial)
  expect(hook.present).toHaveBeenCalledOnce()
  act(() => { hook.result.current.act({ type: 'ROLL_FINISHED' }); hook.result.current.act({ type: 'ROLL' }) })
  expect(hook.result.current.run).toBe(initial)
  await act(async () => hook.result.current.resume())
  expect(hook.result.current.run).toEqual(adventureReducer(initial, { type: 'ROLL_FINISHED' }))
  expect(hook.result.current.run.rng).toBe(initial.rng)
  await act(async () => hook.finish())
  expect(hook.result.current.run.game.rollStreak).toBe(1)
  hook.unmount()
})

it('blocks player selections, abilities and banking while paused and cancels pending completion on exit', async () => {
  vi.useFakeTimers()
  const hook = setup()
  act(() => hook.result.current.act({ type: 'SIT' }))
  act(() => hook.result.current.act({ type: 'ROLL' }))
  act(() => hook.result.current.pause())
  const run = hook.result.current.run
  act(() => {
    hook.result.current.act({ type: 'BANK' })
    hook.result.current.act({ type: 'ABILITY', id: 'golden-one' })
    hook.result.current.act({ type: 'TOGGLE', id: run.pendingDice[0].id })
  })
  expect(hook.result.current.run).toBe(run)
  const saved = hook.data.get(ADVENTURE_KEY)
  hook.unmount()
  await act(async () => { hook.finish(); await vi.advanceTimersByTimeAsync(30000) })
  expect(hook.data.get(ADVENTURE_KEY)).toBe(saved)
  expect(vi.getTimerCount()).toBe(0)
})
