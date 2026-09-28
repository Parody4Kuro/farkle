import { useEffect, useRef, useState } from 'react'
import type { FriendSnapshot } from '../multiplayer/FriendSession'
import { friendSequence, type FriendVisual } from '../multiplayer/presentation'
import { duelView, type SeatId } from '../game/duel'
import type { GameState } from '../game/types'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { GameAudio } from '../audio/gameAudio'

export function useFriendPresentation(snapshot: FriendSnapshot, viewer: SeatId, presentation: RollPresentation, audio: GameAudio, paused: boolean) {
  const [visual, setVisual] = useState<GameState | null>(null)
  const cursor = useRef({ revision: -1, roll: 0, connected: false })
  const work = useRef({ queue: [] as FriendVisual[], abort: new AbortController(), running: false })
  useEffect(() => () => { work.current.abort.abort(); presentation.reset() }, [presentation])
  useEffect(() => {
    const { state, action, status } = snapshot, slot = work.current
    const catchingUp = paused || status !== 'connected' || !cursor.current.connected
    if (catchingUp) {
      slot.abort.abort(); slot.abort = new AbortController(); slot.queue = []; slot.running = false
      presentation.reset(); setVisual(null)
      cursor.current = { revision: state.revision, roll: state.rollSerial, connected: status === 'connected' }
      return
    }
    if (state.revision <= cursor.current.revision) return
    let items = action ? friendSequence(action, state, viewer) : []
    // Older peers can omit the optional summary; their roll records still animate.
    if (!action) items = state.rolls.filter((r) => r.serial > cursor.current.roll).map((roll) => ({ type: 'roll', roll, before: duelView(state, viewer) }))
    cursor.current = { revision: state.revision, roll: state.rollSerial, connected: true }
    slot.queue.push(...items)
    if (slot.queue.length > 18) { slot.queue = []; presentation.skip() }
    if (slot.running || !slot.queue.length) return
    slot.running = true
    const signal = slot.abort.signal
    void (async () => {
      while (slot.queue.length && !signal.aborted) {
        const next = slot.queue.shift()!
        if (next.type === 'action') {
          setVisual(next.action.before); presentation.actions.enqueue(next.action)
          presentation.actions.cue(() => audio.play(next.action.sound ?? (next.action.kind === 'bust' ? 'bust' : next.action.kind === 'hot' ? 'hot-dice' : next.action.kind === 'ability' ? 'charm' : next.action.kind === 'collect' ? 'lock' : next.action.kind === 'victory' ? next.action.after.winner === 'human' ? 'victory' : 'defeat' : 'bank')))
          await presentation.actions.wait(signal)
        } else {
          const { roll } = next
          setVisual({ ...next.before, currentPlayer: roll.actor === viewer ? 'human' : 'ai', phase: 'rolling', rolledDice: roll.dice, diceToRoll: roll.dice.length })
          await presentation.present({ id: roll.serial, dice: roll.dice, player: roll.actor === viewer ? 'human' : 'ai', fast: presentation.actions.preferences.fast, onStart: () => audio.play('roll'), onImpact: (strength) => audio.playImpact?.(strength) }, signal)
        }
      }
      if (!signal.aborted) { slot.running = false; setVisual(null) }
    })()
  }, [snapshot, viewer, presentation, audio, paused])
  return visual
}
