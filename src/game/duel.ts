import { DEFAULT_LOADOUT, DIE_DEFINITIONS } from './dice'
import { loadoutError } from './inventory'
import { createModifierUsage, findBustProtector, getTurnDiceCount, markModifierUsed, MODIFIERS } from './modifiers'
import { cloneGameSettings, createInitialState, TARGET_SCORE_OPTIONS } from './rules'
import { abilityEvent, evaluateSelection } from './selection'
import { SCORING_VERSION } from './scoringVersions'
import { gameReducer } from './state'
import { calculateBestScore } from './scoring'
import type { DieInstance, GameState, ModifierUsage } from './types'

export type SeatId = 'host' | 'guest'
export interface DuelPlayer { dice: string[]; modifiers: string[]; score: number; usage: ModifierUsage; ready: boolean }
export interface DuelRoll { serial: number; actor: SeatId; dice: DieInstance[]; protected: boolean; bust: boolean }
export interface DuelState {
  revision: number; match: number; stage: 'lobby' | 'playing' | 'finished'; mode: 'fair' | 'free'; target: number
  active: SeatId; players: Record<SeatId, DuelPlayer>; game: GameState; rolls: DuelRoll[]; rollSerial: number; winner?: SeatId; notice: string
}
export type MatchCommand =
  | { type: 'CONFIG'; mode: 'fair' | 'free'; target: number }
  | { type: 'LOADOUT'; dice: string[]; modifiers: string[] }
  | { type: 'READY'; ready: boolean }
  | { type: 'ROLL'; selectedIds: string[] }
  | { type: 'BANK'; selectedIds: string[] }
  | { type: 'ABILITY'; modifierId: string; selectedIds: string[] }
  | { type: 'REMATCH' }
export const otherSeat = (seat: SeatId): SeatId => seat === 'host' ? 'guest' : 'host'
export const DUEL_INVENTORY = { dice: Object.fromEntries(DIE_DEFINITIONS.map((d) => [d.id, 6])), modifiers: MODIFIERS.map((m) => m.id) }
const player = (): DuelPlayer => ({ dice: [...DEFAULT_LOADOUT], modifiers: [], score: 0, usage: createModifierUsage(), ready: false })
export function createDuel(): DuelState {
  return { revision: 0, match: 0, stage: 'lobby', mode: 'fair', target: 4000, active: 'host', players: { host: player(), guest: player() }, game: createInitialState(), rolls: [], rollSerial: 0, notice: '双方准备后开始。' }
}
function beginTurn(state: DuelState, active: SeatId): DuelState {
  const p = state.players[active]
  const game = createInitialState({ targetScore: state.target, dieLoadout: [...p.dice], modifierIds: [...p.modifiers], aiDifficulty: 'normal', scoringVersion: SCORING_VERSION })
  game.modifierUsage = createModifierUsage({ ...p.usage.game })
  game.scores = { human: p.score, ai: state.players[otherSeat(active)].score }
  game.turnNumber = state.stage === 'lobby' ? 1 : state.game.turnNumber + 1
  return { ...state, active, game }
}
function keepUsage(state: DuelState): DuelState {
  return { ...state, players: { ...state.players, [state.active]: { ...state.players[state.active], usage: state.game.modifierUsage } } }
}
function selectedGame(game: GameState, ids: string[]): GameState {
  if (ids.length > 7 || new Set(ids).size !== ids.length || ids.some((id) => !game.rolledDice.some((d) => d.id === id))) throw new Error('选择包含过期或未知骰子。')
  if (game.doubledSelection && (ids.length !== game.rolledDice.filter((d) => d.selected).length || game.rolledDice.some((d) => d.selected !== ids.includes(d.id)))) throw new Error('能力已冻结当前选择。')
  return { ...game, rolledDice: game.rolledDice.map((d) => ({ ...d, selected: ids.includes(d.id) })) }
}
export type DrawDice = (ids: string[]) => DieInstance[]
/** All game state is expressed from the active owner's perspective. No seat gets AI rules. */
export function applyMatchCommand(state: DuelState, actor: SeatId, command: MatchCommand, draw: DrawDice): DuelState {
  let next = state
  if (command.type === 'CONFIG') {
    if (actor !== 'host' || state.stage !== 'lobby' || !['fair', 'free'].includes(command.mode) || !(TARGET_SCORE_OPTIONS as readonly number[]).includes(command.target)) throw new Error('不能修改当前对局规则。')
    next = { ...state, mode: command.mode, target: command.target, players: Object.fromEntries((['host', 'guest'] as const).map((seat) => [seat, { ...state.players[seat], ...(command.mode === 'fair' ? { dice: [...DEFAULT_LOADOUT], modifiers: [] } : {}), ready: false }])) as DuelState['players'] }
  } else if (command.type === 'LOADOUT') {
    if (state.stage !== 'lobby' || state.mode !== 'free') throw new Error('只有自由局整备阶段可以配装。')
    const error = loadoutError(DUEL_INVENTORY, command.dice, command.modifiers)
    if (error) throw new Error(error)
    next = { ...state, players: { host: { ...state.players.host, ready: false }, guest: { ...state.players.guest, ready: false }, [actor]: { ...state.players[actor], dice: [...command.dice], modifiers: [...command.modifiers], ready: false } } }
  } else if (command.type === 'READY') {
    if (state.stage !== 'lobby') throw new Error('对局已经开始。')
    next = { ...state, players: { ...state.players, [actor]: { ...state.players[actor], ready: command.ready } } }
    if (next.players.host.ready && next.players.guest.ready) next = { ...beginTurn(next, state.match % 2 === 0 ? 'host' : 'guest'), stage: 'playing', notice: '对局开始。' }
  } else if (command.type === 'REMATCH') {
    if (state.stage !== 'finished') throw new Error('当前对局尚未结束。')
    next = { ...state, stage: 'lobby', match: state.match + 1, winner: undefined, rolls: [], notice: '重新准备后开始，先手交换。', players: { host: { ...state.players.host, score: 0, usage: createModifierUsage(), ready: false }, guest: { ...state.players.guest, score: 0, usage: createModifierUsage(), ready: false } } }
  } else {
    if (state.stage !== 'playing' || state.active !== actor) throw new Error('请等待你的回合。')
    let game = selectedGame(state.game, command.selectedIds)
    if (command.type === 'ABILITY') {
      const event = abilityEvent(game, command.modifierId)
      if (!event) throw new Error('当前不能使用这枚徽章。')
      next = keepUsage({ ...state, game: gameReducer(game, event), notice: 'message' in event ? event.message : state.notice })
    } else if (command.type === 'BANK') {
      const choice = evaluateSelection(game)
      if (game.phase !== 'selecting' || !choice.valid) throw new Error('落袋必须包含本次投掷的合法选择。')
      const score = state.players[actor].score + choice.bankTotal
      const players = { ...state.players, [actor]: { ...state.players[actor], score, usage: game.modifierUsage } }
      const winner = score >= state.target ? actor : undefined
      next = { ...state, players, game: { ...game, phase: winner ? 'game_over' : 'ready', scores: { ...game.scores, human: score }, winner: winner ? 'human' : undefined }, winner, stage: winner ? 'finished' : 'playing', notice: `${actor === 'host' ? '房主' : '朋友'}落袋 ${choice.bankTotal} 分。` }
      if (!winner) next = beginTurn(next, otherSeat(actor))
    } else {
      let ids: string[]
      if (game.phase === 'ready') {
        if (command.selectedIds.length) throw new Error('尚未投骰。')
        ids = [...game.config.dieLoadout, ...Array(Math.max(0, game.diceToRoll - game.config.dieLoadout.length)).fill('standard')]
      } else if (game.phase === 'selecting') {
        const choice = evaluateSelection(game)
        if (!choice.valid) throw new Error('请先选择完整的计分组合。')
        const remaining = game.rolledDice.filter((d) => !d.selected)
        const count = remaining.length || getTurnDiceCount(game.config.modifierIds)
        ids = remaining.length ? remaining.map((d) => d.definitionId) : [...game.config.dieLoadout, ...Array(Math.max(0, count - game.config.dieLoadout.length)).fill('standard')]
        game = gameReducer(game, { type: 'LOCK_SELECTION', keptDice: choice.selectedDice, score: choice.score, nextDiceCount: count, hotDice: !remaining.length, message: !remaining.length ? 'Hot Dice！再次获得完整骰组。' : '继续掷骰。' })
      } else throw new Error('当前不能掷骰。')
      next = { ...state, game }
      for (let attempt = 0; attempt < 2; attempt++) {
        const dice = draw(ids)
        if (dice.length !== ids.length) throw new Error('抽样结果数量不一致。')
        const valid = calculateBestScore(dice.map((d) => d.value), { modifierIds: game.config.modifierIds, player: 'human', version: SCORING_VERSION }).score > 0
        const protector = !valid ? findBustProtector(game.config.modifierIds, game.modifierUsage) : undefined
        next = { ...next, rollSerial: next.rollSerial + 1, rolls: [...next.rolls, { serial: next.rollSerial + 1, actor, dice, protected: Boolean(protector), bust: !valid }].slice(-8) }
        game = { ...game, phase: valid ? 'selecting' : 'bust', rolledDice: dice, diceToRoll: dice.length, rollStreak: game.rollStreak + 1 }
        if (valid) { next = keepUsage({ ...next, game, notice: '选择计分骰，继续或落袋。' }); break }
        if (protector?.useLimit) {
          game = { ...game, modifierUsage: markModifierUsed(game.modifierUsage, protector.id, protector.useLimit.scope) }
          next = { ...next, game, notice: '幸运护符保护，重新投掷。' }
          continue
        }
        next = beginTurn(keepUsage({ ...next, game, notice: `爆骰，失去本回合 ${game.turnScore} 分。` }), otherSeat(actor))
        break
      }
    }
  }
  return { ...next, revision: state.revision + 1 }
}

/** Existing renderers keep their local/other convention; canonical network seats never change. */
export function duelView(state: DuelState, viewer: SeatId, selectedIds: string[] = []): GameState {
  const local = state.active === viewer
  return { ...state.game, config: cloneGameSettings(state.game.config), currentPlayer: local ? 'human' : 'ai',
    scores: { human: state.players[viewer].score, ai: state.players[otherSeat(viewer)].score },
    winner: state.winner ? state.winner === viewer ? 'human' : 'ai' : undefined,
    rolledDice: state.game.rolledDice.map((d) => ({ ...d, selected: state.game.doubledSelection ? d.selected : selectedIds.includes(d.id) })) }
}
