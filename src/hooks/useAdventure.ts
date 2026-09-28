import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { adventureReducer, type AdventureAction, type AdventureRun } from '../game/adventure'
import { createGameAudio, type GameAudio, type SoundCue } from '../audio/gameAudio'
import type { PresentRoll, RollPresentation } from '../presentation/rollPresentation'
import { usePresentationAction } from './usePresentation'
import type { GamePlayback } from '../presentation/GamePlayback'
import { presentSafely } from '../presentation/presentSafely'
import { useGamePlayback } from './useGamePlayback'
import { isPresentationEvent } from '../presentation/events'
import type { PresentationEvent } from '../scene/sceneTypes'
import { saveAdventure, type ComfortPreferences } from '../storage/adventureStorage'
import { AUDIO_KEY, getBrowserStorage, loadAudioPreferences, saveStored } from '../storage/gameStorage'

interface Dependencies {
  initial: AdventureRun
  playback?: GamePlayback
  resumeRequired?: boolean
  presentRoll: PresentRoll
  presentation?: RollPresentation
  comfort: ComfortPreferences
  audio?: GameAudio
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void }
}

export function useAdventure({ initial, presentRoll, presentation, comfort, audio: injectedAudio, storage: injectedStorage, playback: injectedPlayback, resumeRequired }: Dependencies) {
  const storage = injectedStorage ?? getBrowserStorage()
  const [run, setRun] = useState(initial)
  const current = useRef(initial)
  const runId = useRef(0)
  const engaged = useRef(false)
  const [warning, setWarning] = useState(false)
  const [presentationEvent, setPresentationEvent] = useState<PresentationEvent | null>(null)
  const [audioPreferences, setAudioPreferences] = useState(() => loadAudioPreferences(storage))
  const [audio] = useState(() => injectedAudio ?? createGameAudio(audioPreferences))
  const activeAction = usePresentationAction(presentation)
  const control = useGamePlayback({ active: run.stage === 'playing' || Boolean(activeAction), audio, playback: injectedPlayback, resumeRequired })
  const { playback } = control
  const fast = useRef(comfort.fast)
  useLayoutEffect(() => { fast.current = comfort.fast }, [comfort.fast])

  const dispatch = useCallback((action: AdventureAction, expected?: { id: string; revision: number }) => {
    if (expected && (current.current.id !== expected.id || current.current.revision !== expected.revision)) return
    const before = current.current
    const next = adventureReducer(before, action)
    if (next === current.current) return
    // Persist before React/effects start presenting newly drawn results.
    if (!saveAdventure(next, storage, { paused: playback.paused })) setWarning(true)
    if (next.lastEvent) presentation?.animate(next.lastEvent, before.game, next.game)
    current.current = next
    setRun(next)
    const event = next.lastEvent
    if (event && isPresentationEvent(event)) setPresentationEvent({ sequence: next.revision, event })
    let cue: SoundCue | undefined
    if (event?.type === 'BANK') cue = next.game.winner ? next.game.winner === 'human' ? 'victory' : 'defeat' : 'bank'
    if (event?.type === 'BUST') cue = 'bust'
    if (event?.type === 'LOCK_SELECTION') cue = event.hotDice ? 'hot-dice' : 'lock'
    if (event?.type === 'TOGGLE_DIE') cue = 'select'
    if (event?.type === 'USE_GOLDEN_ONE') cue = 'flip'
    if (event?.type === 'USE_DOUBLE_DOWN') cue = 'double'
    if (event?.type === 'MARK_MODIFIER_USED') cue = 'charm'
    if (cue && engaged.current && !playback.paused) {
      const sound = cue
      if (presentation?.actions.busy) presentation.actions.cue(() => audio.play(sound))
      else audio.play(sound)
    }
  }, [storage, audio, playback, presentation])

  const act = useCallback((action: AdventureAction) => {
    if (playback.paused || presentation?.actions.busy) return
    engaged.current = true; void audio.unlock(); dispatch(action)
  }, [audio, dispatch, playback, presentation])

  useEffect(() => {
    const persist = () => { if (!saveAdventure(current.current, storage, { paused: playback.paused })) setWarning(true) }
    const cancel = playback.subscribe(persist)
    const saved = saveAdventure(current.current, storage, { paused: playback.paused })
    const timer = window.setTimeout(() => { if (!saved) setWarning(true) }, 0)
    return () => { cancel(); window.clearTimeout(timer) }
  }, [storage, playback])

  useEffect(() => {
    const riskingScore = run.stage === 'playing' && !['handoff', 'bust', 'charm', 'done'].includes(run.flow) && run.game.turnScore > 0
    audio.setAmbience?.(comfort.environment, comfort.music, riskingScore ? Math.min(4, run.game.rollStreak) : 0)
  }, [audio, comfort.environment, comfort.music, run.stage, run.flow, run.game.rollStreak, run.game.turnScore])

  useEffect(() => {
    const activeRun = ++runId.current
    const controller = new AbortController()
    const expected = { id: run.id, revision: run.revision }
    if (run.stage === 'playing' && run.flow === 'rolling') {
      if (!presentation && engaged.current && !playback.paused) audio.play('roll')
      const present = () => presentSafely(playback, presentRoll, {
        id: run.revision, dice: run.pendingDice, player: run.game.currentPlayer, fast: fast.current,
        onStart: presentation ? () => { if (engaged.current && !playback.paused) audio.play('roll') } : undefined,
        onImpact: (strength) => { if (!controller.signal.aborted && !playback.paused) audio.playImpact?.(strength) },
      }, controller.signal).then(() => {
        playback.whenRunning(() => {
          if (controller.signal.aborted || activeRun !== runId.current) return
          dispatch({ type: 'ROLL_FINISHED' }, expected)
          controller.abort()
        }, controller.signal)
      })
      if (presentation?.actions.busy) void presentation.actions.wait(controller.signal).then(() => { if (!controller.signal.aborted) return present() })
      else void present()
    } else if (run.stage === 'playing' && ['inspect', 'decide', 'handoff', 'bust', 'charm'].includes(run.flow)) {
      const duration = run.flow === 'bust' || run.flow === 'charm' ? 1200 : run.flow === 'decide' ? 900 : 650
      void Promise.all([playback.wait(duration * (fast.current ? 0.3 : 1), controller.signal), presentation?.actions.wait(controller.signal)]).then(() => {
        if (!controller.signal.aborted && activeRun === runId.current) dispatch({ type: 'TICK' }, expected)
      })
    }
    return () => { controller.abort() }
  }, [run, presentRoll, audio, dispatch, playback, presentation])

  useEffect(() => () => { presentation?.reset(); playback.cancelAll(); if (!injectedAudio) void audio.dispose() }, [audio, injectedAudio, playback, presentation])

  const setVolume = (volume: number) => {
    const prefs = { ...audioPreferences, volume: Math.max(0, Math.min(1, volume)) }
    if (!playback.paused) void audio.unlock(); audio.setVolume(prefs.volume); setAudioPreferences(prefs)
    if (!saveStored(storage, AUDIO_KEY, prefs)) setWarning(true)
  }
  const toggleAudio = () => {
    const prefs = { ...audioPreferences, enabled: !audioPreferences.enabled }
    audio.setEnabled(prefs.enabled); setAudioPreferences(prefs)
    if (!saveStored(storage, AUDIO_KEY, prefs)) setWarning(true)
  }
  return { ...control, run, act, warning, presentationEvent, audioPreferences, setVolume, toggleAudio }
}
