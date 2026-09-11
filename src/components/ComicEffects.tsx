import { useEffect, useState } from 'react'
import { eventCue, type Cue } from '../presentation/events'
import type { PresentationEvent } from '../scene/sceneTypes'

function Burst({ cue }: { cue: Cue }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), cue.kind === 'lock' ? 420 : 1300)
    return () => window.clearTimeout(timeout)
  }, [cue.kind])
  if (!visible) return null
  return (
    <div className={'comic-effect effect-' + cue.kind + (cue.player ? ' to-' + cue.player : '')} aria-hidden="true">
      <span className="effect-spark spark-one">✦</span>
      <strong>{cue.title}</strong>
      <span>{cue.subtitle}</span>
      <span className="effect-spark spark-two">✧</span>
    </div>
  )
}

export function ComicEffects({ event }: { event: PresentationEvent | null }) {
  const cue = event ? eventCue(event) : null
  return cue && event ? <Burst key={event.sequence} cue={cue} /> : null
}
