import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { usePresentationAction } from '../hooks/usePresentation'
import { actionProgress, smooth } from '../presentation/ActionPlayback'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { PlayerId } from '../game/types'

export function AnimatedScore({ value, player = 'human', field = 'total', presentation }: { value: number; player?: PlayerId; field?: 'total' | 'turn'; presentation?: RollPresentation }) {
  const ref = useRef<HTMLSpanElement>(null)
  const action = usePresentationAction(presentation)
  useLayoutEffect(() => {
    let frame = 0
    const tick = () => {
      if (!ref.current) return
      let shown = value
      if (action && presentation) {
        const from = field === 'turn' ? action.before.turnScore : action.before.scores[player]
        const to = field === 'turn' ? action.after.turnScore : action.after.scores[player]
        const p = actionProgress(action, presentation.playback.now())
        const t = presentation.actions.preferences.reducedMotion ? 1 : action.kind === 'victory' ? smooth((p - .25) / .24) : smooth((p - .5) / .35)
        shown = Math.round(from + (to - from) * t)
        if (p < 1 && !presentation.playback.paused) frame = requestAnimationFrame(tick)
      }
      ref.current.textContent = shown.toLocaleString()
    }
    tick()
    const stop = presentation?.playback.subscribe(() => { cancelAnimationFrame(frame); tick() })
    return () => { cancelAnimationFrame(frame); stop?.() }
  }, [value, player, field, action, presentation])
  return <span role="status" aria-live="off" aria-label={value.toLocaleString()} data-score-player={player} data-score-field={field}><span ref={ref} aria-hidden="true">{value.toLocaleString()}</span></span>
}

export function PresentationHUD({ presentation }: { presentation: RollPresentation }) {
  const action = usePresentationAction(presentation)
  const roll = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, () => null)
  const { paused } = useSyncExternalStore(presentation.playback.subscribe, presentation.playback.getSnapshot, presentation.playback.getSnapshot)
  const flight = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!action || paused) return
    let frame = 0
    const tick = () => {
      const node = flight.current
      if (!node) return
      const t = actionProgress(action, presentation.playback.now())
      const target = document.querySelector<HTMLElement>(`[data-score-player="${action.player}"][data-score-field="total"]`)
      if (target && (action.kind === 'bank' || action.kind === 'victory') && !presentation.actions.preferences.reducedMotion) {
        const rect = target.getBoundingClientRect(), parent = node.parentElement!.getBoundingClientRect()
        const winning = action.kind === 'victory'
        const p = winning ? smooth((t - .1) / .3) : smooth((t - .3) / .35)
        node.style.transform = `translate(${(rect.x + rect.width / 2 - parent.x - parent.width / 2) * p}px,${(rect.y + rect.height / 2 - parent.y - parent.height / 2) * p}px) scale(${1 - p * 0.35})`
        const fade = winning ? .48 : .7
        node.style.opacity = String(t > fade ? Math.max(0, (fade + .15 - t) / .15) : smooth(t / .15))
      }
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    tick(); return () => cancelAnimationFrame(frame)
  }, [action, paused, presentation])
  if (!action && !roll) return null
  return <div className="presentation-hud" data-presentation-active={action?.kind ?? 'roll'}>
    {action && <div key={action.id} className={`presentation-cue cue-${action.kind}`} role="status" aria-live="polite"><span>{action.title}</span>{action.amount > 0 && <strong>{action.kind === 'bust' ? '−' : '+'}{action.amount.toLocaleString()}</strong>}</div>}
    {action && action.amount > 0 && <div className="score-flight-origin" aria-hidden="true"><div ref={flight} className="score-flight">{action.kind === 'bust' ? '−' : '+'}{action.amount.toLocaleString()}</div></div>}
    <button type="button" className="skip-presentation" disabled={paused} onClick={presentation.skip}>跳过本次演出 <span aria-hidden="true">↠</span></button>
  </div>
}
