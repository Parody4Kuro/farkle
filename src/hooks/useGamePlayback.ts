import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { GameAudio } from '../audio/gameAudio'
import { bindGamePlayback } from '../platform/visibility'
import { GamePlayback } from '../presentation/GamePlayback'

export function useGamePlayback({ active, audio, playback: injected, resumeRequired = false }: {
  active: boolean; audio: GameAudio; playback?: GamePlayback; resumeRequired?: boolean
}) {
  const [playback] = useState(() => injected ?? new GamePlayback(resumeRequired))
  const snapshot = useSyncExternalStore(playback.subscribe, playback.getSnapshot, playback.getSnapshot)
  useLayoutEffect(() => { playback.setActive(active) }, [active, playback])
  useLayoutEffect(() => {
    if (resumeRequired) playback.pause()
  }, [resumeRequired, playback])
  useLayoutEffect(() => bindGamePlayback(playback), [playback])
  useLayoutEffect(() => {
    const update = () => {
      if (audio.setPaused) audio.setPaused(playback.paused)
      else if (playback.paused) void audio.suspend()
    }
    update()
    return playback.subscribe(update)
  }, [audio, playback])
  const resume = useCallback(() => {
    if (playback.resume()) void audio.unlock()
  }, [audio, playback])
  return { playback, paused: snapshot.paused, canResume: snapshot.canResume, pause: playback.pause, resume }
}
