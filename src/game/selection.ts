import { applyScoreModifiers, canUseModifier, getModifier } from './modifiers'
import { validateSelectedDice } from './scoring'
import type { GameState, ScoringContext } from './types'
import type { GameEvent } from './state'

export function scoringContext(state: GameState): ScoringContext {
  return { modifierIds: state.currentPlayer === 'human' ? state.config.modifierIds : [],
    player: state.currentPlayer, version: state.config.scoringVersion }
}

/** Preview, lock and bank share both the chosen partition and the final amount. */
export function evaluateSelection(state: GameState) {
  const selectedDice = state.rolledDice.filter((die) => die.selected)
  const context = scoringContext(state)
  const choice = validateSelectedDice(selectedDice.map((die) => die.value), context)
  const groupScore = choice.score
  const beforeDouble = applyScoreModifiers(context.modifierIds, groupScore, state.currentPlayer)
  const doubleBonus = state.doubledSelection ? beforeDouble : 0
  const score = beforeDouble + doubleBonus
  return { ...choice, selectedDice, score, groupScore, beforeDouble, doubleBonus,
    baseScore: choice.groups.reduce((sum, group) => sum + (group.baseScore ?? group.score), 0),
    totalAdjustment: beforeDouble - groupScore, bankTotal: choice.valid ? state.turnScore + score : 0 }
}

export function modifierDisabledReason(state: GameState, modifierId: string): string | undefined {
  const modifier = getModifier(modifierId)
  if (!modifier?.activation || !state.config.modifierIds.includes(modifierId)) return '尚未装备这项能力。'
  if (state.currentPlayer !== 'human' || state.phase !== 'selecting') return '等待你的选骰阶段。'
  if (!canUseModifier(modifier, state.modifierUsage)) return '本次使用次数已用完。'
  if (state.doubledSelection) return '孤注一掷已锁定选择与骰值，请继续掷骰或保存分数。'
  const selected = state.rolledDice.filter((die) => die.selected)
  if (modifier.activation.ability === 'golden-one' && selected.length !== 1) return '使用黄金一点前，请只选择一颗本次新投出的骰子。'
  if (modifier.activation.ability === 'double-down' && !evaluateSelection(state).valid) return '使用孤注一掷前，请先完成一个合法计分选择。'
  return undefined
}

export function abilityReasons(state: GameState): Record<string, string | undefined> {
  return Object.fromEntries(state.config.modifierIds.map((id) => [id, modifierDisabledReason(state, id)]))
}

export function abilityEvent(state: GameState, modifierId: string): GameEvent | undefined {
  if (modifierDisabledReason(state, modifierId)) return undefined
  const activation = getModifier(modifierId)!.activation!
  if (activation.ability === 'golden-one') return {
    type: 'USE_GOLDEN_ONE', modifierId, scope: activation.scope,
    dieId: state.rolledDice.find((die) => die.selected)!.id,
    message: '黄金一点将选中的骰子变成了 1。',
  }
  return { type: 'USE_DOUBLE_DOWN', modifierId, scope: activation.scope,
    message: `孤注一掷！当前选择价值 ${evaluateSelection(state).beforeDouble * 2} 分。选择与骰值已锁定。` }
}
