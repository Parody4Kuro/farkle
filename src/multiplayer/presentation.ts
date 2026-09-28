import { duelView, type DuelState, type MatchCommand, type SeatId, type DuelRoll } from '../game/duel'
import { abilityEvent, evaluateSelection } from '../game/selection'
import { gameReducer } from '../game/state'
import type { GameState } from '../game/types'
import { actionForEvent, type ActionRequest } from '../presentation/ActionPlayback'
import { isDuelSnapshot, parseCommand } from './protocol'

/** Optional presentation metadata. Canonical rules and revisions never wait for it. */
export interface DuelActionSummary {
  sequence: number; actor: SeatId; command: MatchCommand; before: GameState
  scores: { host: number; guest: number }; rollSerial: number
}
export function summarizeAction(before: DuelState, after: DuelState, actor: SeatId, command: MatchCommand): DuelActionSummary | undefined {
  if (!['ROLL', 'BANK', 'ABILITY'].includes(command.type)) return undefined
  return { sequence: after.revision, actor, command: structuredClone(command), before: structuredClone(before.game), scores: { host: before.players.host.score, guest: before.players.guest.score }, rollSerial: before.rollSerial }
}
export function parseActionSummary(value: unknown, state: DuelState): DuelActionSummary | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as DuelActionSummary
  try {
    const command = parseCommand(v.command)
    if (!['ROLL', 'BANK', 'ABILITY'].includes(command.type) || v.sequence !== state.revision || !['host','guest'].includes(v.actor) || !Number.isSafeInteger(v.rollSerial) || v.rollSerial < 0 || v.rollSerial > state.rollSerial) return undefined
    if (!v.scores || ![v.scores.host,v.scores.guest].every((n) => Number.isSafeInteger(n) && n >= 0)) return undefined
    if (!isDuelSnapshot({ ...state, game: v.before })) return undefined
    return { ...v, command }
  } catch { return undefined }
}
export type FriendVisual = { type: 'action'; action: ActionRequest } | { type: 'roll'; roll: DuelRoll; before: GameState }
export function friendSequence(summary: DuelActionSummary, state: DuelState, viewer: SeatId): FriendVisual[] {
  const items: FriendVisual[] = [], player = summary.actor === viewer ? 'human' : 'ai'
  const command = summary.command
  if (!('selectedIds' in command)) return items
  let before: GameState = { ...structuredClone(summary.before), currentPlayer: player, scores: { human: summary.scores[viewer], ai: summary.scores[viewer === 'host' ? 'guest' : 'host'] }, rolledDice: summary.before.rolledDice.map((d) => ({ ...d, selected: command.selectedIds.includes(d.id) })) }
  const after = duelView(state, viewer)
  const add = (action: ActionRequest | null) => { if (action) items.push({ type: 'action', action }) }
  const id = `net:${state.match}:${summary.sequence}`
  const choice = evaluateSelection({ ...before, currentPlayer: 'human' })
  if (command.type === 'BANK') {
    add(actionForEvent(id + ':bank', { type: 'BANK', player, turnTotal: choice.bankTotal, keptDice: choice.selectedDice, message: '', winningMessage: '' }, before, after))
  } else if (command.type === 'ABILITY') {
    const event = abilityEvent({ ...before, currentPlayer: 'human' }, command.modifierId)
    if (event) add(actionForEvent(id + ':ability', event, before, after))
  } else {
    if (before.phase === 'selecting' && choice.valid) {
      const count = before.rolledDice.length - choice.selectedDice.length
      const event = { type: 'LOCK_SELECTION' as const, keptDice: choice.selectedDice, score: choice.score, nextDiceCount: count || after.diceToRoll, hotDice: !count, message: '' }
      const locked = gameReducer(before, event)
      add(actionForEvent(id + ':collect', event, before, locked)); before = locked
    }
    for (const roll of state.rolls.filter((r) => r.serial > summary.rollSerial)) {
      items.push({ type: 'roll', roll, before })
      const rolled = { ...before, rolledDice: roll.dice, phase: 'selecting' as const }
      if (roll.bust) {
        if (roll.protected) add({ id: id + ':protect:' + roll.serial, kind: 'ability', player, before: rolled, after: rolled, diceIds: roll.dice.map((d) => d.id), amount: 0, title: '幸运护符 · 再掷一次' })
        else add(actionForEvent(id + ':bust:' + roll.serial, { type: 'BUST', dice: roll.dice, message: '' }, rolled, after))
      }
      before = rolled
    }
  }
  return items
}
