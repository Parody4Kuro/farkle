import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { adventureReducer, createAdventure, ORIGINS, type AdventureAction, type AdventureRun } from '../src/game/adventure'
import { CORE_IDS, CORE_MODIFIERS, SCORING_VERSION } from '../src/game/cores'
import { calculateBestScore } from '../src/game/scoring'
import { shouldAiContinue } from '../src/game/ai'
import { addInventoryItem, loadoutError } from '../src/game/inventory'
import { canUseModifier, getModifier } from '../src/game/modifiers'
import { bustProbability, nextHumanLoadout } from '../src/game/risk'
import { evaluateSelection } from '../src/game/selection'
import { normalizeAdventure } from '../src/storage/adventureStorage'
import type { AiDifficulty, DiceValue, ScoreResult } from '../src/game/types'

// Reproducible, bounded heuristic comparisons. This does not simulate human enjoyment.
const samples = Number(process.argv[2] ?? 60)
assert(Number.isInteger(samples) && samples >= 1 && samples <= 1000, 'sample count must be 1–1000')
const seedBase = Number(process.argv[3] ?? 18017)
assert(Number.isInteger(seedBase) && seedBase > 0 && seedBase < 0xffffffff)
const outputPath = process.argv[4] ?? 'docs/build-simulation.json'
const styles = (process.argv[5] ?? 'normal,aggressive').split(',') as AiDifficulty[]
assert(styles.length > 0 && styles.every((style) => ['conservative', 'normal', 'aggressive'].includes(style)))
const seeds = Array.from({ length: samples }, (_, i) => seedBase + i * 7919)
const cache = new Map<string, ScoreResult>()
function best(values: DiceValue[], modifiers: string[]) {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => String(a.value).localeCompare(String(b.value)))
  const key = `${modifiers.join(',')}:${order.map((d) => d.value).join(',')}`
  let result = cache.get(key)
  if (!result) {
    result = calculateBestScore(order.map((d) => d.value), { modifierIds: modifiers, player: 'human', version: SCORING_VERSION })
    cache.set(key, result)
  }
  return { score: result.score, indices: [...new Set(result.groups.flatMap((g) => g.dieIndices.map((i) => order[i].index)))].sort((a, b) => a - b),
    kinds: result.groups.map((g) => g.kind), base: result.groups.reduce((sum, g) => sum + (g.baseScore ?? g.score), 0) }
}

interface Metrics { humanRolls: number; banks: number[]; busts: number; singles: number; kinds: number; straights: number; changedSelections: number; selections: number; abilities: number }
function metrics(): Metrics { return { humanRolls: 0, banks: [], busts: 0, singles: 0, kinds: 0, straights: 0, changedSelections: 0, selections: 0, abilities: 0 } }
interface Played { won: boolean; metrics: Metrics; tableWins: number; retries: number; rewards: string[]; finalModifiers: string[]; finalDice: string[] }

function action(run: AdventureRun, input: AdventureAction, measure: Metrics, audit: boolean) {
  const next = adventureReducer(run, input)
  assert.notEqual(next, run, `No transition: ${run.stage}/${run.flow}/${input.type}`)
  if (input.type === 'ROLL_FINISHED' && run.game.currentPlayer === 'human') measure.humanRolls++
  if (next.lastEvent?.type === 'BANK' && next.lastEvent.player === 'human') measure.banks.push(next.lastEvent.turnTotal)
  if (next.lastEvent?.type === 'BUST' && run.game.currentPlayer === 'human') measure.busts++
  if (input.type === 'ABILITY') measure.abilities++
  if (audit) {
    const restored = normalizeAdventure(JSON.parse(JSON.stringify(next)))
    assert(restored, `Invalid serialized state: ${next.stage}/${next.flow}`)
    assert.equal(restored.rng, next.rng)
    assert.equal(restored.rewardRng, next.rewardRng)
    assert.deepEqual(restored.pendingDice, next.pendingDice)
    assert.equal(loadoutError(restored.inventory, restored.loadout, restored.modifiers), null)
  }
  return next
}

function playSelection(run: AdventureRun, style: AiDifficulty, measure: Metrics, audit: boolean) {
  const mods = run.modifiers
  const apply = (input: AdventureAction) => { run = action(run, input, measure, audit) }
  const gold = getModifier('golden-one')!
  if (mods.includes(gold.id) && canUseModifier(gold, run.game.modifierUsage)) {
    const values = run.game.rolledDice.map((d) => d.value)
    const original = best(values, mods)
    const options = values.map((value, i) => ({ i, score: value === 1 ? original.score : best(values.map((v, j) => j === i ? 1 : v), mods).score }))
    const upgrade = options.sort((a, b) => b.score - a.score)[0]
    if (upgrade.score > original.score) {
      apply({ type: 'TOGGLE', id: run.game.rolledDice[upgrade.i].id })
      apply({ type: 'ABILITY', id: gold.id })
    }
  }
  const values = run.game.rolledDice.map((d) => d.value)
  const choice = best(values, mods), base = best(values, [])
  measure.selections++
  if (JSON.stringify(choice.indices) !== JSON.stringify(base.indices) || JSON.stringify(choice.kinds) !== JSON.stringify(base.kinds)) measure.changedSelections++
  for (const kind of choice.kinds) measure[kind === 'single' ? 'singles' : kind === 'kind' ? 'kinds' : 'straights']++
  for (let i = 0; i < run.game.rolledDice.length; i++) {
    if (run.game.rolledDice[i].selected !== choice.indices.includes(i)) apply({ type: 'TOGGLE', id: run.game.rolledDice[i].id })
  }
  const double = getModifier('double-down')!
  const game = run.game
  if (mods.includes(double.id) && canUseModifier(double, game.modifierUsage)
    && (choice.score >= 350 || game.scores.human + game.turnScore + choice.score * 2 >= game.config.targetScore)) apply({ type: 'ABILITY', id: double.id })
  const selected = evaluateSelection(run.game)
  assert(selected.valid)
  const ids = nextHumanLoadout(run.game)
  const again = !run.game.doubledSelection && shouldAiContinue({ difficulty: style, turnScore: selected.bankTotal,
    remainingDice: ids.length, aiScore: game.scores.human, humanScore: game.scores.ai, targetScore: game.config.targetScore,
    hotDice: choice.indices.length === values.length, bustProbability: bustProbability(ids) })
  return action(run, { type: again ? 'ROLL' : 'BANK' }, measure, audit)
}

function priorities(core: string) {
  const dice = core === 'core-steady' ? ['lucky-one', 'lucky-five', 'odd-fellow', 'joker', 'high-roller']
    : core === 'core-kindred' ? ['joker', 'lucky-one', 'high-roller', 'odd-fellow', 'lucky-five']
      : ['joker', 'high-roller', 'odd-fellow', 'lucky-one', 'lucky-five']
  return [core, 'lucky-charm', 'loaded-hand', ...dice, 'golden-one', 'double-down']
}

function play(run: AdventureRun, core: string, style: AiDifficulty, fullNight: boolean, audit: boolean): Played {
  const measure = metrics(), rewards: string[] = []
  const rank = priorities(core)
  const index = (id: string) => rank.includes(id) ? rank.indexOf(id) : 99
  for (let step = 0; step < 6000; step++) {
    if (run.stage === 'won' || run.stage === 'lost' || (!fullNight && run.stage !== 'playing')) {
      return { won: fullNight ? run.stage === 'won' : run.history.at(-1)?.winner === 'human', metrics: measure,
        tableWins: run.history.filter((h) => h.winner === 'human').length, retries: run.history.filter((h) => h.attempt > 1).length,
        rewards, finalModifiers: run.modifiers, finalDice: run.loadout }
    }
    if (run.stage === 'core') { run = action(run, { type: 'SELECT_CORE', id: core }, measure, audit); continue }
    if (run.stage === 'seat') {
      const modifiers = [core, ...run.inventory.modifiers.filter((id) => id !== core && getModifier(id)?.category !== 'core').sort((a, b) => index(a) - index(b))].slice(0, 2)
      const loadout = Object.entries(run.inventory.dice).flatMap(([id, count]) => Array<string>(count).fill(id)).sort((a, b) => index(a) - index(b)).slice(0, 6)
      run = action(run, { type: 'SIT', loadout, modifiers }, measure, audit)
      continue
    }
    if (run.stage === 'reward') {
      const reward = [...run.rewards].sort((a, b) => index(a.definitionId) - index(b.definitionId))[0]
      rewards.push(reward.definitionId)
      run = action(run, { type: 'REWARD', id: reward.id, offerId: run.rewardOfferId! }, measure, audit)
      continue
    }
    if (run.flow === 'selecting') { run = playSelection(run, style, measure, audit); continue }
    run = action(run, { type: run.flow === 'ready' ? 'ROLL' : run.flow === 'rolling' ? 'ROLL_FINISHED' : 'TICK' }, measure, audit)
  }
  throw new Error(`Step cap reached: ${run.id}`)
}

const mean = (numbers: number[]) => numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0
const round = (n: number) => Math.round(n * 1000) / 1000
function summarize(rows: Played[]) {
  const rolls = rows.reduce((n, r) => n + r.metrics.humanRolls, 0), selections = rows.reduce((n, r) => n + r.metrics.selections, 0)
  return { runs: rows.length, wins: rows.filter((r) => r.won).length, winRate: round(mean(rows.map((r) => Number(r.won)))),
    meanBank: round(mean(rows.flatMap((r) => r.metrics.banks))), meanHumanRolls: round(mean(rows.map((r) => r.metrics.humanRolls))),
    bustsPerRoll: round(rows.reduce((n, r) => n + r.metrics.busts, 0) / Math.max(1, rolls)),
    changedSelectionRate: round(rows.reduce((n, r) => n + r.metrics.changedSelections, 0) / Math.max(1, selections)),
    groupCounts: { single: rows.reduce((n, r) => n + r.metrics.singles, 0), kind: rows.reduce((n, r) => n + r.metrics.kinds, 0), straight: rows.reduce((n, r) => n + r.metrics.straights, 0) },
    abilityUses: rows.reduce((n, r) => n + r.metrics.abilities, 0), retries: rows.reduce((n, r) => n + r.retries, 0) }
}

const nights = []
for (const origin of ORIGINS) for (const core of CORE_IDS) {
  const played = seeds.map((seed, i) => play(createAdventure(seed, `night:${origin.id}:${core}:${seed}`, origin.id), core, 'normal', true, i === 0))
  nights.push({ origin: origin.id, core, ...summarize(played), samplePath: played[0] })
  console.log('night', origin.id, core, summarize(played))
}

const duels = []
const configurations = [[], ...CORE_IDS.map((id) => [id]), ['lucky-charm', 'loaded-hand'],
  ...CORE_IDS.flatMap((id) => ['lucky-charm', 'loaded-hand', 'golden-one', 'double-down'].map((support) => [id, support]))]
const profiles = [
  { id: 'fair-first-table', origin: 'traveller', table: 0, rewardDice: [] as string[] },
  { id: 'artisan-boss', origin: 'artisan', table: 3, rewardDice: [] as string[] },
  { id: 'two-jokers-boss', origin: 'wanderer', table: 3, rewardDice: ['joker'] },
]
for (const profile of profiles) for (const style of styles) for (const modifiers of configurations) {
  // The first table has only its free opening core. Boss kits fit three earned rewards.
  if (profile.table === 0 && modifiers.length > 1) continue
  const played = seeds.map((seed, i) => {
    const core = modifiers.find((id) => CORE_IDS.includes(id)) ?? CORE_IDS[0]
    let run = adventureReducer(createAdventure(seed, `duel:${profile.id}:${seed}`, profile.origin), { type: 'SELECT_CORE', id: core })
    run = { ...run, table: profile.table, modifiers, loadout: [...run.loadout] }
    for (const id of modifiers) run = { ...run, inventory: addInventoryItem(run.inventory, 'modifier', id) }
    for (const id of profile.rewardDice) {
      run = { ...run, inventory: addInventoryItem(run.inventory, 'die', id) }
      run.loadout[run.loadout.indexOf('standard')] = id
    }
    run = adventureReducer(run, { type: 'SIT' })
    return play(run, core, style, false, i === 0)
  })
  duels.push({ profile: profile.id, style, modifiers, ...summarize(played) })
}
const evidence = {
  protocol: 'Heuristic simulation v1; shared pure reducer, weighted RNG, adjusted DFS; each row reuses the same starting seed list, then actions may consume different streams.',
  scoringVersion: SCORING_VERSION, cores: CORE_MODIFIERS.map(({ id, benefit, cost }) => ({ id, benefit, cost })),
  samplesPerRow: samples, seedBase, seedStride: 7919,
  limitations: ['No timing or human preference model.', 'Risk policies are heuristics, not optimal play.',
    'Boss rows compare reachable equipment counterfactuals, not the probability of drawing those rewards.',
    'Full nights keep the opening core equipped to measure that direction; actual players may change it.',
    'Golden One takes the largest immediate positive gain; Double Down activates at 350 selected points or a winning opportunity.',
    `At ${samples} runs per row, a 50% win rate has an approximate 95% binomial margin of ±${Math.round(98 / Math.sqrt(samples))} percentage points.`],
  nights, duels,
}
writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + '\n')
console.log(`Saved ${nights.length} night rows and ${duels.length} duel rows to ${outputPath}; all completed.`)
