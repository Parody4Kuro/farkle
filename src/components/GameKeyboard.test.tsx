// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GameKeyboard } from './GameKeyboard'
afterEach(() => { cleanup(); vi.useRealTimers() })
it('selects the seventh die, navigates and blocks input/editing/repeat shortcuts', () => {
  const choose = vi.fn(), roll = vi.fn(), bank = vi.fn()
  render(<main>{Array.from({ length: 7 }, (_, i) => <button key={i} data-die-id={`d${i}`} onClick={() => choose(i)}>{i + 1}</button>)}<input aria-label="message" /><GameKeyboard enabled canRoll canBank onRoll={roll} onBank={bank} abilities={[]} onAbility={() => {}} /></main>)
  fireEvent.keyDown(document, { key: '7' }); expect(choose).toHaveBeenLastCalledWith(6)
  fireEvent.keyDown(document, { key: 'ArrowLeft' }); fireEvent.keyDown(document, { key: 'e' }); expect(choose).toHaveBeenLastCalledWith(5)
  fireEvent.keyDown(document, { key: 'f', repeat: true }); expect(roll).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'f' }); expect(roll).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'f', isComposing: true }); expect(roll).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'f' }); expect(roll).toHaveBeenCalledTimes(1)
})
it('requires a continuous 400ms hold and cancels on release, blur or another command', () => {
  vi.useFakeTimers(); const bank = vi.fn()
  render(<main><GameKeyboard enabled canRoll canBank onRoll={() => {}} onBank={bank} abilities={[]} onAbility={() => {}} /></main>)
  fireEvent.keyDown(document, { key: 'q' }); act(() => vi.advanceTimersByTime(200)); fireEvent.keyUp(document, { key: 'q' }); act(() => vi.advanceTimersByTime(500)); expect(bank).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'q' }); fireEvent.blur(window); act(() => vi.advanceTimersByTime(500)); expect(bank).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'q' }); fireEvent.compositionStart(document); act(() => vi.advanceTimersByTime(500)); expect(bank).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'q' }); act(() => vi.advanceTimersByTime(400)); expect(bank).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(document, { key: 'q', repeat: true }); act(() => vi.advanceTimersByTime(500)); expect(bank).toHaveBeenCalledTimes(1)
})

it('dispatches ordered abilities and closes details before pausing', () => {
  const ability = vi.fn(), pause = vi.fn()
  render(<main><button aria-label="暂停对局" onClick={pause} /><details open><summary>明细</summary>内容</details><GameKeyboard enabled canRoll canBank onRoll={() => {}} onBank={() => {}} abilities={[{ id: 'first', enabled: true }, { id: 'second', enabled: true }]} onAbility={ability} /></main>)
  fireEvent.keyDown(document, { key: 'r' }); expect(ability).toHaveBeenLastCalledWith('first')
  fireEvent.keyDown(document, { key: 'R', shiftKey: true }); expect(ability).toHaveBeenLastCalledWith('second')
  fireEvent.keyDown(document, { key: 'Escape' }); expect(document.querySelector('details')?.open).toBe(false); expect(pause).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'Escape' }); expect(pause).toHaveBeenCalledOnce()
})
