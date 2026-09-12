import type { GamePlayback } from '../presentation/GamePlayback'

interface DesktopLifecycle {
  isVisible(): boolean
  onVisibilityChange(callback: () => void): () => void
  isFocused?(): boolean
  onFocusChange?(callback: () => void): () => void
}

/** Visibility and focus are independent blockers; returning only clears the blocker. */
export function bindGamePlayback(playback: GamePlayback): () => void {
  let focused = document.hasFocus()
  const visibility = () => playback.setBlocked('页面已隐藏', isGameHidden())
  const focus = () => playback.setBlocked('窗口未激活', !focused || window.tavernDesktop?.isFocused?.() === false)
  const onBlur = () => { focused = false; focus() }
  const onFocus = () => { focused = true; focus() }
  const stopVisibility = onGameVisibilityChange(visibility)
  const stopFocus = window.tavernDesktop?.onFocusChange?.(focus)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)
  visibility(); focus()
  return () => {
    stopVisibility(); stopFocus?.()
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
  }
}
declare global { interface Window { tavernDesktop?: DesktopLifecycle } }

/** Native minimization and Chromium's Page Visibility API can differ on macOS. */
export function isGameHidden(): boolean {
  return document.hidden || window.tavernDesktop?.isVisible() === false
}

export function onGameVisibilityChange(callback: () => void): () => void {
  let previous = isGameHidden()
  const notify = () => {
    const next = isGameHidden()
    if (next === previous) return
    previous = next
    callback()
  }
  document.addEventListener('visibilitychange', notify)
  const unsubscribe = window.tavernDesktop?.onVisibilityChange(notify)
  return () => {
    document.removeEventListener('visibilitychange', notify)
    unsubscribe?.()
  }
}
