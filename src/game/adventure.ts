import { rollDice } from './dice'
import { chooseAiDice, shouldAiContinue } from './ai'
import { findBustProtector, MODIFIERS } from './modifiers'
import { opponentAt } from './opponents'
import { createInitialState } from './rules'
import { hasAnyScore, validateSelectedDice } from './scoring'
import { gameReducer, type GameEvent } from './state'
import { bustProbability, nextHumanLoadout } from './risk'
import type { DieInstance, GameState, PlayerId } from './types'
import { abilityEvent, evaluateSelection, modifierDisabledReason } from './selection'
import { CORE_MODIFIERS, SCORING_VERSION } from './cores'
import { addInventoryItem, createStartingInventory, loadoutError, type Inventory } from './inventory'
import type { ScoringVersion } from './scoringVersions'

export type RunStage = 'core' | 'seat' | 'playing' | 'reward' | 'won' | 'lost'
export type DuelFlow = 'ready' | 'rolling' | 'selecting' | 'inspect' | 'decide' | 'handoff' | 'bust' | 'charm' | 'done'
export interface Reward { id: string; kind: 'die' | 'modifier'; definitionId: string }
export interface TableResult { table: number; attempt: number; winner: PlayerId; humanScore: number; aiScore: number; peak: number }
export interface AdventureRun {
  version: 2
  scoringVersion: ScoringVersion
  inventory: Inventory
  opening: { offers: string[]; selected: string | null; source: 'new' | 'migrated' }
  rewardOfferId: string | null
  id: string
  revision: number
  rng: number
  rewardRng: number
  table: number
  losses: number
  stage: RunStage
  flow: DuelFlow
  loadout: string[]
  modifiers: string[]
  game: GameState
  pendingDice: DieInstance[]
  remainingLoadout: string[]
  rewards: Reward[]
  history: TableResult[]
  peak: number
  largestBust: number
  lastEvent?: GameEvent
}

export interface Origin { id: string; name: string; description: string; loadout: string[] }
export const ORIGINS: Origin[] = [
  { id: 'traveller', name: '初来乍到', description: '六颗公平骰。今晚的故事，由你开始。', loadout: Array<string>(6).fill('standard') },
  { id: 'artisan', name: '商路旧识', description: '工匠之五、高地骰与四颗公平骰。偏爱五点，也敢追求高点组合。', loadout: ['lucky-five', 'high-roller', ...Array<string>(4).fill('standard')] },
  { id: 'wanderer', name: '夜行旅人', description: 'Joker、高地骰与四颗公平骰。寻找能被骷髅补全的组合。', loadout: ['joker', 'high-roller', ...Array<string>(4).fill('standard')] },
]

export function randomStep(seed: number): { seed: number; value: number } {
  let x = seed >>> 0 || 0x9e3779b9
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5
  return { seed: x >>> 0, value: (x >>> 0) / 4294967296 }
}

function gameFor(run: Pick<AdventureRun, 'loadout' | 'modifiers' | 'table' | 'scoringVersion'>): GameState {
  return createInitialState({ targetScore: run.table === 3 ? 4000 : 2000, aiDifficulty: opponentAt(run.table).difficulty,
    dieLoadout: [...run.loadout], modifierIds: [...run.modifiers], scoringVersion: run.scoringVersion })
}

export function createAdventure(seed: number, id: string, origin = 'traveller'): AdventureRun {
  const loadout = [...(ORIGINS.find((o) => o.id === origin) ?? ORIGINS[0]).loadout]
  return { version: 2, scoringVersion: SCORING_VERSION, inventory: createStartingInventory(loadout),
    opening: { offers: CORE_MODIFIERS.map((m) => m.id), selected: null, source: 'new' }, rewardOfferId: null,
    id, revision: 0, rng: seed >>> 0 || 1, rewardRng: (seed ^ 0xa53c917b) >>> 0 || 1,
    table: 0, losses: 0, stage: 'core', flow: 'ready', loadout, modifiers: [],
    game: gameFor({ loadout, modifiers: [], table: 0, scoringVersion: SCORING_VERSION }), pendingDice: [], remainingLoadout: [], rewards: [],
    history: [], peak: 0, largestBust: 0 }
}

export type AdventureAction =
  | { type: 'SELECT_CORE'; id: string }
  | { type: 'SIT'; loadout?: string[]; modifiers?: string[] }
  | { type: 'ROLL' }
  | { type: 'ROLL_FINISHED' }
  | { type: 'TICK' }
  | { type: 'TOGGLE'; id: string }
  | { type: 'ABILITY'; id: string }
  | { type: 'BANK' }
  | { type: 'REWARD'; id: string; offerId: string }
  | { type: 'SKIP_REWARD'; offerId: string }

function apply(run: AdventureRun, event: GameEvent): AdventureRun {
  return { ...run, game: gameReducer(run.game, event), lastEvent: event }
}

function draw(run: AdventureRun, ids: string[]): AdventureRun {
  let rng = run.rng
  let index = 0
  const dice = rollDice(ids, ids.length, () => {
    const next = randomStep(rng); rng = next.seed; return next.value
  }, () => `${run.id}:${run.revision}:${index++}`)
  const actor = run.game.currentPlayer === 'human' ? '你' : opponentAt(run.table).name
  const next = apply(run, { type: 'ROLL_STARTED', diceCount: ids.length, message: `${actor}掷出 ${ids.length} 颗骰子……` })
  return { ...next, flow: 'rolling', rng, pendingDice: dice, remainingLoadout: [...ids] }
}

function offerRewards(run: AdventureRun): AdventureRun {
  let seed = run.rewardRng
  const pool: Reward[] = [
    ...['lucky-one', 'lucky-five', 'high-roller', 'odd-fellow', 'joker'].map((id) => ({ id: `die:${id}`, kind: 'die' as const, definitionId: id })),
    ...MODIFIERS.filter((m) => !run.inventory.modifiers.includes(m.id)).map((m) => ({ id: `modifier:${m.id}`, kind: 'modifier' as const, definitionId: m.id })),
  ]
  const rewards: Reward[] = []
  for (let i = 0; i < 3; i++) {
    const next = randomStep(seed); seed = next.seed
    rewards.push(pool.splice(Math.floor(next.value * pool.length), 1)[0])
  }
  return { ...run, rewards, rewardRng: seed, rewardOfferId: `${run.id}:${run.table}:${run.history.length}` }
}

function finishTable(run: AdventureRun): AdventureRun {
  const winner = run.game.winner!
  const losses = run.losses + Number(winner === 'ai')
  const history = [...run.history, { table: run.table, attempt: run.history.filter((h) => h.table === run.table).length + 1, winner, humanScore: run.game.scores.human,
    aiScore: run.game.scores.ai, peak: run.peak }]
  const next: AdventureRun = { ...run, losses, history, flow: 'done', pendingDice: [] }
  if (losses >= 2) return { ...next, stage: 'lost' }
  if (run.table === 3) return { ...next, stage: winner === 'human' ? 'won' : 'seat' }
  if (winner === 'ai') return { ...next, stage: 'seat' }
  return offerRewards({ ...next, stage: 'reward' })
}

function bank(run: AdventureRun, score: number, keptDice: DieInstance[]): AdventureRun {
  const player = run.game.currentPlayer
  const total = run.game.turnScore + score
  const name = player === 'human' ? '你' : opponentAt(run.table).name
  const next = apply(run, { type: 'BANK', player, turnTotal: total, keptDice,
    message: `${name}保存了 ${total} 分。`, winningMessage: `${name}赢下了这一桌。` })
  const updated = { ...next, peak: player === 'human' ? Math.max(next.peak, total) : next.peak, flow: 'handoff' as const }
  return next.game.winner ? finishTable(updated) : updated
}

function handoff(run: AdventureRun): AdventureRun {
  const human = run.game.currentPlayer === 'ai'
  const next = apply(run, { type: 'BEGIN_TURN', player: human ? 'human' : 'ai', turnNumber: run.game.turnNumber + Number(human) })
  return human ? { ...next, flow: 'ready' } : draw(next, opponentAt(run.table).loadout)
}

function transition(run: AdventureRun, action: AdventureAction): AdventureRun {
  if (run.stage === 'core') {
    if (action.type !== 'SELECT_CORE' || !run.opening.offers.includes(action.id) || run.opening.selected) return run
    return { ...run, stage: 'seat', inventory: addInventoryItem(run.inventory, 'modifier', action.id),
      modifiers: [action.id], opening: { ...run.opening, selected: action.id } }
  }
  if (action.type === 'SIT' && run.stage === 'seat') {
    const loadout = [...(action.loadout ?? run.loadout)], modifiers = [...(action.modifiers ?? run.modifiers)]
    if (loadoutError(run.inventory, loadout, modifiers)) return run
    return { ...run, loadout, modifiers, stage: 'playing', flow: 'ready', game: gameFor({ ...run, loadout, modifiers }),
      pendingDice: [], remainingLoadout: [], rewards: [], rewardOfferId: null }
  }
  if (run.stage === 'reward') {
    if ((action.type !== 'REWARD' && action.type !== 'SKIP_REWARD') || action.offerId !== run.rewardOfferId) return run
    if (action.type === 'SKIP_REWARD') return { ...run, stage: 'seat', table: run.table + 1, rewards: [], rewardOfferId: null }
    const reward = run.rewards.find((r) => r.id === action.id)
    if (!reward) return run
    const inventory = addInventoryItem(run.inventory, reward.kind, reward.definitionId)
    if (inventory === run.inventory) return run
    return { ...run, inventory, stage: 'seat', table: run.table + 1, rewards: [], rewardOfferId: null }
  }
  if (run.stage !== 'playing') return run
  const game = run.game
  if (action.type === 'ROLL_FINISHED' && run.flow === 'rolling') {
    const dice = run.pendingDice
    const valid = hasAnyScore(dice.map((d) => d.value))
    const human = game.currentPlayer === 'human'
    let next = apply(run, { type: 'ROLL_RESOLVED', dice, nextPhase: valid ? human ? 'selecting' : 'ai_thinking' : 'bust',
      countPlayerRoll: human, message: valid ? human ? '选择计分骰，再决定继续或落袋。' : `${opponentAt(run.table).name}正在端详骰子。` : '爆骰！' })
    next = { ...next, pendingDice: [] }
    if (valid) return { ...next, flow: human ? 'selecting' : 'inspect' }
    const protector = human ? findBustProtector(game.config.modifierIds, game.modifierUsage) : undefined
    if (protector?.useLimit) {
      next = apply(next, { type: 'MARK_MODIFIER_USED', modifierId: protector.id, scope: protector.useLimit.scope })
      return { ...next, flow: 'charm', game: { ...next.game, message: '护符挡下爆骰。使用次数已消耗，即将重投。' } }
    }
    next = apply(next, { type: 'BUST', dice, message: `${human ? '你' : opponentAt(run.table).name}爆骰，本回合临时分归零。` })
    return { ...next, flow: 'bust', largestBust: human ? Math.max(run.largestBust, game.turnScore) : run.largestBust }
  }
  if (action.type === 'TICK') {
    if (run.flow === 'handoff' || run.flow === 'bust') return handoff(run)
    if (run.flow === 'charm') return draw(run, run.remainingLoadout)
    if (run.flow === 'inspect') {
      const choice = chooseAiDice(game.rolledDice.map((d) => d.value))
      const next = apply(run, { type: 'SHOW_SELECTION', dice: game.rolledDice.map((d, i) => ({ ...d, selected: choice.indices.includes(i) })),
        message: `${opponentAt(run.table).name}选择了 ${choice.score} 分。` })
      return { ...next, flow: 'decide' }
    }
    if (run.flow === 'decide') {
      const kept = game.rolledDice.filter((d) => d.selected)
      const choice = validateSelectedDice(kept.map((d) => d.value))
      const remaining = game.rolledDice.filter((d) => !d.selected).map((d) => d.definitionId)
      const hot = remaining.length === 0
      const ids = hot ? opponentAt(run.table).loadout : remaining
      const deficit = game.scores.human - game.scores.ai
      const difficulty = run.table === 3 ? deficit > 600 ? 'aggressive' : deficit < -600 ? 'conservative' : 'normal' : opponentAt(run.table).difficulty
      if (!shouldAiContinue({ difficulty, turnScore: game.turnScore + choice.score, remainingDice: ids.length,
        aiScore: game.scores.ai, humanScore: game.scores.human, targetScore: game.config.targetScore, hotDice: hot,
        bustProbability: bustProbability(ids) })) return bank(run, choice.score, kept)
      const event: GameEvent = { type: 'LOCK_SELECTION', keptDice: kept, score: choice.score, nextDiceCount: ids.length, hotDice: hot,
        message: `${opponentAt(run.table).name}决定继续冒险。` }
      return { ...draw(apply(run, event), ids), lastEvent: event }
    }
    return run
  }
  if (game.currentPlayer !== 'human') return run
  if (action.type === 'ROLL' && run.flow === 'ready') return draw(run, nextHumanLoadout(game))
  if (run.flow !== 'selecting') return run
  if (action.type === 'TOGGLE') return apply(run, { type: 'TOGGLE_DIE', dieId: action.id })
  const choice = evaluateSelection(game)
  const kept = choice.selectedDice
  const score = choice.score
  if (action.type === 'ABILITY') {
    const event = abilityEvent(game, action.id)
    return event ? apply(run, event) : apply(run, { type: 'SET_MESSAGE', message: modifierDisabledReason(game, action.id) ?? game.message })
  }
  if (!choice.valid) return run
  if (action.type === 'BANK') return bank(run, score, kept)
  if (action.type === 'ROLL') {
    const ids = nextHumanLoadout(game)
    const hot = kept.length === game.rolledDice.length
    const event: GameEvent = { type: 'LOCK_SELECTION', keptDice: kept, score, nextDiceCount: ids.length,
      hotDice: hot, message: hot ? 'HOT DICE！获得完整骰组，继续这一回合。' : `锁定 ${score} 分，继续冒险。` }
    return { ...draw(apply(run, event), ids), lastEvent: event }
  }
  return run
}

/** All random draws, rewards and state transitions are synchronous, serializable and replayable. */
export function adventureReducer(run: AdventureRun, action: AdventureAction): AdventureRun {
  const cleared = { ...run, lastEvent: undefined }
  const next = transition(cleared, action)
  if (next === cleared) return run
  return { ...next, revision: run.revision + 1 }
}
