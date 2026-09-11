import { isGameHidden, onGameVisibilityChange } from '../platform/visibility'
import { useCallback, useEffect, useRef, useState } from 'react'
import { adventureReducer, type AdventureAction, type AdventureRun } from '../game/adventure'
import { createGameAudio, type GameAudio, type SoundCue } from '../audio/gameAudio'
import type { PresentRoll } from '../presentation/rollPresentation'
import { isPresentationEvent } from '../presentation/events'
import type { PresentationEvent } from '../scene/sceneTypes'
import { saveAdventure, type ComfortPreferences } from '../storage/adventureStorage'
import { AUDIO_KEY, getBrowserStorage, loadAudioPreferences, saveStored } from '../storage/gameStorage'

interface Dependencies {
  initial: AdventureRun
  presentRoll: PresentRoll
  comfort: ComfortPreferences
  audio?: GameAudio
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void }
}

export function useAdventure({ initial, presentRoll, comfort, audio: injectedAudio, storage: injectedStorage }: Dependencies) {
  const storage = injectedStorage ?? getBrowserStorage()
  const [run, setRun] = useState(initial)
  const current = useRef(initial)
  const runId = useRef(0)
  const engaged = useRef(false)
  const [warning, setWarning] = useState(false)
  const [presentationEvent, setPresentationEvent] = useState<PresentationEvent | null>(null)
  const [audioPreferences, setAudioPreferences] = useState(() => loadAudioPreferences(storage))
  const [audio] = useState(() => injectedAudio ?? createGameAudio(audioPreferences))

  const dispatch = useCallback((action: AdventureAction, expected?: { id: string; revision: number }) => {
    if (expected && (current.current.id !== expected.id || current.current.revision !== expected.revision)) return
    const next = adventureReducer(current.current, action)
    if (next === current.current) return
    // Persist before React/effects start presenting newly drawn results.
    if (!saveAdventure(next, storage)) setWarning(true)
    current.current = next
    setRun(next)
    const event = next.lastEvent
    if (event && isPresentationEvent(event)) setPresentationEvent({ sequence: next.revision, event })
    let cue: SoundCue | undefined
    if (event?.type === 'BANK') cue = next.game.winner ? next.game.winner === 'human' ? 'victory' : 'defeat' : 'bank'
    if (event?.type === 'BUST') cue = 'bust'
    if (event?.type === 'LOCK_SELECTION') cue = event.hotDice ? 'hot-dice' : 'lock'
    if (event?.type === 'TOGGLE_DIE' || event?.type === 'USE_GOLDEN_ONE' || event?.type === 'USE_DOUBLE_DOWN') cue = 'select'
    if (cue && engaged.current && !isGameHidden()) audio.play(cue)
  }, [storage, audio])

  const act = useCallback((action: AdventureAction) => { engaged.current = true; void audio.unlock(); dispatch(action) }, [audio, dispatch])

  useEffect(() => {
    if (!saveAdventure(current.current, storage)) {
      const timer = window.setTimeout(() => setWarning(true), 0)
      return () => window.clearTimeout(timer)
    }
  }, [storage])

  useEffect(() => {
    const riskingScore = run.stage === 'playing' && !['handoff', 'bust', 'charm', 'done'].includes(run.flow) && run.game.turnScore > 0
    audio.setAmbience?.(comfort.environment, comfort.music, riskingScore ? Math.min(4, run.game.rollStreak) : 0)
  }, [audio, comfort.environment, comfort.music, run.stage, run.flow, run.game.rollStreak, run.game.turnScore])

  useEffect(() => {
    const activeRun = ++runId.current
    const controller = new AbortController()
    const expected = { id: run.id, revision: run.revision }
    let timer: number | undefined
    let timeout: number | undefined
    let finish: (() => void) | undefined
    const visible = () => { if (isGameHidden()) { void audio.suspend(); finish?.() } else if (engaged.current) void audio.unlock() }
    const stopVisibility = onGameVisibilityChange(visible)
    if (run.stage === 'playing' && run.flow === 'rolling') {
      if (engaged.current && !isGameHidden()) audio.play('roll')
      let done = false
      finish = () => {
        if (done || controller.signal.aborted || activeRun !== runId.current) return
        done = true
        window.clearTimeout(timeout)
        controller.abort()
        dispatch({ type: 'ROLL_FINISHED' }, expected)
      }
      timeout = window.setTimeout(finish, 6000)
      try {
        const playing = presentRoll({ id: run.revision, dice: run.pendingDice, player: run.game.currentPlayer, fast: comfort.fast,
          onImpact: (strength) => { if (!controller.signal.aborted && !isGameHidden()) audio.playImpact?.(strength) } }, controller.signal)
        void playing.then(finish, finish)
      } catch { finish() }
      if (isGameHidden()) finish()
    } else if (run.stage === 'playing' && ['inspect', 'decide', 'handoff', 'bust', 'charm'].includes(run.flow)) {
      const duration = run.flow === 'bust' || run.flow === 'charm' ? 1200 : run.flow === 'decide' ? 900 : 650
      timer = window.setTimeout(() => {
        if (!controller.signal.aborted && activeRun === runId.current) dispatch({ type: 'TICK' }, expected)
      }, duration * (comfort.fast ? 0.3 : 1))
    }
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      window.clearTimeout(timeout)
      stopVisibility()
    }
  }, [run, presentRoll, comfort.fast, audio, dispatch])

  useEffect(() => () => { if (!injectedAudio) void audio.dispose() }, [audio, injectedAudio])

  const setVolume = (volume: number) => {
    const prefs = { ...audioPreferences, volume: Math.max(0, Math.min(1, volume)) }
    void audio.unlock(); audio.setVolume(prefs.volume); setAudioPreferences(prefs)
    if (!saveStored(storage, AUDIO_KEY, prefs)) setWarning(true)
  }
  const toggleAudio = () => {
    const prefs = { ...audioPreferences, enabled: !audioPreferences.enabled }
    audio.setEnabled(prefs.enabled); setAudioPreferences(prefs)
    if (!saveStored(storage, AUDIO_KEY, prefs)) setWarning(true)
  }
  return { run, act, warning, presentationEvent, audioPreferences, setVolume, toggleAudio }
}
