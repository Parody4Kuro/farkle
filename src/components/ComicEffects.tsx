import { useEffect, useState } from 'react'
import { eventCue, type Cue } from '../presentation/events'
import type { PresentationEvent } from '../scene/sceneTypes'
import type { GamePlayback } from '../presentation/GamePlayback'

function Burst({ cue, playback }: { cue: Cue; playback: GamePlayback }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    return playback.schedule(() => setVisible(false), cue.kind === 'lock' ? 420 : 1300)
  }, [cue.kind, playback])
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

export function ComicEffects({ event, playback }: { event: PresentationEvent | null; playback: GamePlayback }) {
  const cue = event ? eventCue(event) : null
  return cue && event ? <Burst key={event.sequence} cue={cue} playback={playback} /> : null
}
