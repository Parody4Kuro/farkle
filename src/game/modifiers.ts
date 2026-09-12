import { CORE_MODIFIERS, getCoreModifiers, SCORING_VERSION } from './cores'
import type {
  GameModifier,
  ModifierAbility,
  ModifierUsage,
  ModifierUseScope,
  PlayerId,
  ScoreGroup,
  ScoringContext,
} from './types'

export const MODIFIERS: GameModifier[] = [
  {
    id: 'lucky-charm',
    name: '幸运护符',
    description: '每回合第一次爆骰时免除损失，并重投当前骰子。',
    symbol: '☘',
    onBust: () => 'reroll',
    useLimit: { scope: 'turn', maxUses: 1 },
  },
  {
    id: 'loaded-hand',
    name: '满载之手',
    description: '你的每个回合开始时额外获得一颗普通骰。',
    symbol: '✋',
    modifyDice: (diceCount, context) => context.player === 'human' ? diceCount + 1 : diceCount,
  },
  {
    id: 'golden-one',
    name: '黄金一点',
    description: '每回合一次，将一颗本次新投出的骰子变成 1。',
    symbol: '☀',
    activation: { ability: 'golden-one', scope: 'turn', maxUses: 1 },
  },
  {
    id: 'double-down',
    name: '孤注一掷',
    description: '每局一次，使当前合法选择的分数翻倍。',
    symbol: 'Ⅱ',
    activation: { ability: 'double-down', scope: 'game', maxUses: 1 },
  },
  ...CORE_MODIFIERS,
]

export function getModifier(id: string, version: number = SCORING_VERSION): GameModifier | undefined {
  const modifier = MODIFIERS.find((modifier) => modifier.id === id)
  return modifier?.category === 'core' ? getCoreModifiers(version).find((core) => core.id === id) : modifier
}

export function getModifiers(ids: readonly string[], version: number = SCORING_VERSION): GameModifier[] {
  return ids.map((id) => getModifier(id, version)).filter((modifier): modifier is GameModifier => Boolean(modifier))
}

export function getSingleDiceLimit(context?: ScoringContext): number {
  if (!context) return Infinity
  return getModifiers(context.modifierIds, context.version).reduce(
    (limit, modifier) => Math.min(limit, modifier.maxSinglesPerFace ?? Infinity), Infinity,
  )
}

export function createModifierUsage(game: Record<string, number> = {}): ModifierUsage {
  return { turn: {}, game: { ...game } }
}

export function resetTurnModifierUsage(usage: ModifierUsage): ModifierUsage {
  return createModifierUsage(usage.game)
}

export function getModifierUseCount(
  usage: ModifierUsage,
  modifierId: string,
  scope: ModifierUseScope,
): number {
  return usage[scope][modifierId] ?? 0
}

export function markModifierUsed(
  usage: ModifierUsage,
  modifierId: string,
  scope: ModifierUseScope,
): ModifierUsage {
  return {
    turn: scope === 'turn'
      ? { ...usage.turn, [modifierId]: getModifierUseCount(usage, modifierId, scope) + 1 }
      : { ...usage.turn },
    game: scope === 'game'
      ? { ...usage.game, [modifierId]: getModifierUseCount(usage, modifierId, scope) + 1 }
      : { ...usage.game },
  }
}

export function canUseModifier(modifier: GameModifier, usage: ModifierUsage): boolean {
  const limit = modifier.activation ?? modifier.useLimit
  if (!limit) return true
  return getModifierUseCount(usage, modifier.id, limit.scope) < limit.maxUses
}

export function getActiveModifiers(ids: string[], ability?: ModifierAbility): GameModifier[] {
  return getModifiers(ids).filter((modifier) => (
    modifier.activation && (!ability || modifier.activation.ability === ability)
  ))
}

export function findBustProtector(ids: string[], usage: ModifierUsage): GameModifier | undefined {
  return getModifiers(ids).find((modifier) => (
    modifier.onBust?.() === 'reroll' && canUseModifier(modifier, usage)
  ))
}

export function getTurnDiceCount(ids: string[], baseDiceCount = 6, player: PlayerId = 'human'): number {
  return getModifiers(ids).reduce(
    (diceCount, modifier) => modifier.modifyDice?.(diceCount, { player }) ?? diceCount,
    baseDiceCount,
  )
}

export function applyScoreModifiers(ids: readonly string[], score: number, player: PlayerId): number {
  return getModifiers(ids).reduce(
    (currentScore, modifier) => modifier.modifyScore?.(currentScore, { player }) ?? currentScore,
    score,
  )
}

export function applyGroupModifiers(group: ScoreGroup, context?: ScoringContext): ScoreGroup {
  if (!context) return group
  return getModifiers(context.modifierIds, context.version).reduce((current, modifier) => {
    if (!modifier.modifyGroup) return current
    const score = modifier.modifyGroup(current, { player: context.player ?? 'human', version: context.version ?? SCORING_VERSION })
    if (!Number.isSafeInteger(score) || score <= 0) throw new RangeError('Scoring modifiers must preserve positive integer groups')
    if (score === current.score) return current
    return { ...current, score, baseScore: current.baseScore ?? current.score,
      adjustments: [...(current.adjustments ?? []), { modifierId: modifier.id, label: modifier.name, amount: score - current.score }] }
  }, group)
}
