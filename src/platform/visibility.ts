interface DesktopLifecycle {
  isVisible(): boolean
  onVisibilityChange(callback: () => void): () => void
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
