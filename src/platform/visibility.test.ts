// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { bindGamePlayback, isGameHidden, onGameVisibilityChange } from './visibility'
import { GamePlayback } from '../presentation/GamePlayback'

afterEach(() => { delete window.tavernDesktop; vi.restoreAllMocks() })

it('preserves browser visibility and releases its listener', () => {
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  const callback = vi.fn()
  const dispose = onGameVisibilityChange(callback)
  expect(isGameHidden()).toBe(false)
  hidden.mockReturnValue(true)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(isGameHidden()).toBe(true)
  expect(callback).toHaveBeenCalledOnce()
  dispose()
  hidden.mockReturnValue(false)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(callback).toHaveBeenCalledOnce()
})

it('treats native minimization as hidden and resumes only when both sources are visible', () => {
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  let visible = true
  let notify = () => {}
  const unsubscribe = vi.fn()
  window.tavernDesktop = { isVisible: () => visible, onVisibilityChange: (callback) => { notify = callback; return unsubscribe } }
  const callback = vi.fn()
  const dispose = onGameVisibilityChange(callback)
  visible = false; notify()
  expect(isGameHidden()).toBe(true)
  expect(callback).toHaveBeenCalledTimes(1)
  hidden.mockReturnValue(true)
  document.dispatchEvent(new Event('visibilitychange'))
  visible = true; notify()
  expect(isGameHidden()).toBe(true)
  expect(callback).toHaveBeenCalledTimes(1)
  hidden.mockReturnValue(false)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(isGameHidden()).toBe(false)
  expect(callback).toHaveBeenCalledTimes(2)
  dispose()
  expect(unsubscribe).toHaveBeenCalledOnce()
})

it('combines browser focus, native focus and visibility without automatically continuing', () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  let focused = true, notify = () => {}
  const disposeNative = vi.fn()
  window.tavernDesktop = { isVisible: () => true, onVisibilityChange: () => () => {},
    isFocused: () => focused, onFocusChange: (callback) => { notify = callback; return disposeNative } }
  const playback = new GamePlayback()
  playback.setActive(true)
  const stop = bindGamePlayback(playback)
  window.dispatchEvent(new Event('blur'))
  expect(playback.paused).toBe(true)
  focused = false; notify()
  window.dispatchEvent(new Event('focus'))
  expect(playback.resume()).toBe(false)
  focused = true; notify()
  expect(playback.getSnapshot().canResume).toBe(true)
  expect(playback.paused).toBe(true)
  playback.resume()
  expect(playback.paused).toBe(false)
  stop()
  expect(disposeNative).toHaveBeenCalledOnce()
  window.dispatchEvent(new Event('blur'))
  expect(playback.paused).toBe(false)
})
