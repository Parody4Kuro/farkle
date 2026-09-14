import { SCORING_VERSION } from '../game/scoringVersions'
import type { MatchCommand } from '../game/duel'
export const PROTOCOL_VERSION = 1
export const RULES_VERSION = `tavern-duel-1-scoring-${SCORING_VERSION}`
export interface Invitation { protocol: number; rules: string; kind: 'offer' | 'answer'; session: string; secret: string; channel: string; resume: boolean; sdp: string }
export function encodeInvitation(value: Invitation): string {
  return 'TB1.' + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
}
export function decodeInvitation(text: string, kind: Invitation['kind']): Invitation {
  if (text.length > 131072 || !text.trim().startsWith('TB1.')) throw new Error('不是有效的 Tavern Bones 连接文本。')
  let packet: Invitation
  try { packet = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text.trim().slice(4)), (c) => c.charCodeAt(0)))) } catch { throw new Error('连接文本不完整，请重新复制。') }
  if (!packet || packet.protocol !== PROTOCOL_VERSION || packet.rules !== RULES_VERSION) throw new Error('双方游戏或规则版本不一致，请使用同一版本。')
  if (packet.kind !== kind || typeof packet.sdp !== 'string' || !packet.sdp.startsWith('v=0') || typeof packet.resume !== 'boolean' || ![packet.session, packet.secret, packet.channel].every((s) => typeof s === 'string' && /^[\w-]{20,80}$/.test(s))) throw new Error('连接文本类型或内容不正确。')
  return packet
}
export function parseCommand(value: unknown): MatchCommand {
  if (!value || typeof value !== 'object') throw new Error('无效操作。')
  const v = value as Record<string, unknown>
  const strings = (a: unknown, limit: number): a is string[] => Array.isArray(a) && a.length <= limit && a.every((s) => typeof s === 'string' && s.length < 100)
  if (v.type === 'CONFIG' && (v.mode === 'fair' || v.mode === 'free') && typeof v.target === 'number') return { type: v.type, mode: v.mode, target: v.target }
  if (v.type === 'LOADOUT' && strings(v.dice, 6) && strings(v.modifiers, 2)) return { type: v.type, dice: v.dice, modifiers: v.modifiers }
  if (v.type === 'READY' && typeof v.ready === 'boolean') return { type: v.type, ready: v.ready }
  if (v.type === 'REMATCH') return { type: v.type }
  if ((v.type === 'ROLL' || v.type === 'BANK') && strings(v.selectedIds, 7)) return { type: v.type, selectedIds: v.selectedIds }
  if (v.type === 'ABILITY' && typeof v.modifierId === 'string' && v.modifierId.length < 100 && strings(v.selectedIds, 7)) return { type: v.type, modifierId: v.modifierId, selectedIds: v.selectedIds }
  throw new Error('无效操作格式。')
}

/** Validate the full shape before a remote snapshot can reach React or the scene. */
export function isDuelSnapshot(value: unknown): value is import('../game/duel').DuelState {
  const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
  const count = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0
  const seat = (v: unknown) => v === 'host' || v === 'guest'
  const strings = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && x.length < 100)
  const usage = (v: unknown) => record(v) && record(v.turn) && record(v.game) && Object.values(v.turn).every(count) && Object.values(v.game).every(count)
  const die = (v: unknown) => record(v) && typeof v.id === 'string' && typeof v.definitionId === 'string' && typeof v.selected === 'boolean' && (v.value === 'JOKER' || [1,2,3,4,5,6].includes(v.value as number))
  if (!record(value) || !count(value.revision) || !count(value.match) || !count(value.rollSerial) || !seat(value.active) || !['lobby','playing','finished'].includes(value.stage as string) || !['fair','free'].includes(value.mode as string) || !count(value.target) || typeof value.notice !== 'string' || (value.winner !== undefined && !seat(value.winner))) return false
  if (!record(value.players) || !['host','guest'].every((key) => { const p = (value.players as Record<string, unknown>)[key]; return record(p) && strings(p.dice,6) && (p.dice as unknown[]).length === 6 && strings(p.modifiers,2) && count(p.score) && usage(p.usage) && typeof p.ready === 'boolean' })) return false
  const game = value.game
  if (!record(game) || !record(game.config) || !strings(game.config.dieLoadout,6) || !strings(game.config.modifierIds,2) || !count(game.config.targetScore) || !record(game.scores) || !count(game.scores.human) || !count(game.scores.ai) || !count(game.turnScore) || !count(game.diceToRoll) || (game.diceToRoll as number) > 7 || !usage(game.modifierUsage) || !count(game.turnNumber) || !count(game.rollStreak) || typeof game.doubledSelection !== 'boolean' || typeof game.isHotDice !== 'boolean' || typeof game.message !== 'string' || game.currentPlayer !== 'human' || !['ready','rolling','selecting','bust','game_over'].includes(game.phase as string)) return false
  if (!Array.isArray(game.rolledDice) || game.rolledDice.length > 7 || !game.rolledDice.every(die) || !Array.isArray(game.lockedDice) || !game.lockedDice.every(die)) return false
  return Array.isArray(value.rolls) && value.rolls.length <= 8 && value.rolls.every((roll) => record(roll) && count(roll.serial) && seat(roll.actor) && typeof roll.protected === 'boolean' && typeof roll.bust === 'boolean' && Array.isArray(roll.dice) && roll.dice.length <= 7 && roll.dice.every(die))
}
