// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { isGameHidden, onGameVisibilityChange } from './visibility'

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
