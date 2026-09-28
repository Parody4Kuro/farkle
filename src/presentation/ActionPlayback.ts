import type { SoundCue } from '../audio/gameAudio'
import type { GameEvent } from '../game/state'
import type { GameState, PlayerId } from '../game/types'
import type { GamePlayback } from './GamePlayback'

export type ActionKind = 'collect' | 'bank' | 'bust' | 'hot' | 'ability' | 'victory'
export interface PresentationPreferences { fast: boolean; cinematic: boolean; reducedMotion: boolean; quality: 'auto' | 'high' | 'low' }
export const DEFAULT_PRESENTATION: PresentationPreferences = { fast: false, cinematic: true, reducedMotion: false, quality: 'auto' }
export interface ActionRequest {
  id: string; kind: ActionKind; player: PlayerId; before: GameState; after: GameState
  sound?: SoundCue; diceIds: string[]; amount: number; title: string
}
export interface ActionFrame extends ActionRequest { startedAt: number; duration: number }
const durations: Record<ActionKind, number> = { collect: 950, bank: 1800, bust: 1500, hot: 1100, ability: 700, victory: 2700 }
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const smooth = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t) }
export function actionProgress(action: ActionFrame, now: number) { return clamp01((now - action.startedAt) / action.duration) }

/** Immutable visual transactions. No reducer calls or gameplay random draws live here. */
export class ActionPlayback {
  private current: ActionFrame | null = null
  private queue: ActionRequest[] = []
  private listeners = new Set<() => void>()
  private seen = new Set<string>()
  private cancelTimer = () => {}
  private cues = new Set<() => void>()
  preferences = { ...DEFAULT_PRESENTATION }
  readonly clock: GamePlayback
  constructor(clock: GamePlayback) { this.clock = clock }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getSnapshot = () => this.current
  getPreferences = () => this.preferences
  private publish() { for (const fn of this.listeners) fn() }
  get busy() { return this.current !== null || this.queue.length > 0 }
  configure(value: PresentationPreferences) { this.preferences = { ...value }; this.publish() }
  enqueue(request: ActionRequest) {
    if (this.seen.has(request.id)) return
    this.seen.add(request.id)
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    // Bounded network catch-up: obsolete animation must not hold the table hostage.
    if (this.queue.length >= 12) this.clear()
    this.queue.push(structuredClone(request))
    this.advance()
  }
  private advance() {
    if (this.current) return
    const request = this.queue.shift()
    if (!request) { this.publish(); return }
    const duration = this.preferences.reducedMotion ? 100 : durations[request.kind] * (this.preferences.fast ? 0.3 : 1)
    this.current = { ...request, startedAt: this.clock.now(), duration }
    this.cancelTimer = this.clock.schedule(this.finish, duration)
    this.publish()
  }
  finish = () => {
    this.cancelTimer(); this.cancelTimer = () => {}
    for (const cancel of this.cues) cancel()
    this.cues.clear()
    this.current = null
    this.advance()
  }
  clear = () => {
    this.queue = []
    this.finish()
  }
  reset = () => { this.clear(); this.seen.clear() }
  cue(callback: () => void, at = 0.6) {
    const action = this.current
    if (!action) { if (!this.clock.paused) callback(); return }
    const cancel = this.clock.schedule(() => { this.cues.delete(cancel); callback() }, Math.max(0, action.startedAt + action.duration * at - this.clock.now()))
    this.cues.add(cancel)
  }
  wait(signal?: AbortSignal): Promise<void> {
    if (!this.busy || signal?.aborted) return Promise.resolve()
    return new Promise((resolve) => {
      const finish = () => { stop(); signal?.removeEventListener('abort', finish); resolve() }
      const stop = this.subscribe(() => { if (!this.busy) finish() })
      signal?.addEventListener('abort', finish, { once: true })
    })
  }
}

export function actionForEvent(id: string, event: GameEvent, before: GameState, after: GameState): ActionRequest | null {
  const base = { id, before, after, player: before.currentPlayer, diceIds: [] as string[], amount: 0, title: '' }
  switch (event.type) {
    case 'LOCK_SELECTION': return { ...base, kind: event.hotDice ? 'hot' : 'collect', diceIds: event.keptDice.map((d) => d.id), amount: event.score, title: event.hotDice ? '手气正热' : '收入计分托盘' }
    case 'BANK': return { ...base, player: event.player, kind: after.winner ? 'victory' : 'bank', diceIds: (event.keptDice ?? before.rolledDice.filter((d) => d.selected)).map((d) => d.id), amount: event.turnTotal, title: after.winner ? (after.winner === 'human' ? '这一桌，属于你' : '对手赢下这一桌') : '落袋为安' }
    case 'BUST': return { ...base, before: { ...before, rolledDice: event.dice }, kind: 'bust', amount: before.turnScore, title: '爆骰 · 本回合归零' }
    case 'USE_GOLDEN_ONE': return { ...base, kind: 'ability', sound: 'flip', diceIds: [event.dieId], title: '黄金一点' }
    case 'USE_DOUBLE_DOWN': return { ...base, kind: 'ability', sound: 'double', diceIds: before.rolledDice.filter((d) => d.selected).map((d) => d.id), title: '孤注一掷' }
    case 'MARK_MODIFIER_USED': return { ...base, kind: 'ability', sound: 'charm', diceIds: before.rolledDice.map((d) => d.id), title: '幸运护符 · 再掷一次' }
    default: return null
  }
}
