import type { GameModifier, ModifierUsage } from './types'

export const MODIFIERS: GameModifier[] = [
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    description: 'Once each turn, the first bust is forgiven and all dice are rerolled.',
    onBust: (usage) => !usage.luckyCharmUsed,
  },
  {
    id: 'loaded-hand',
    name: 'Loaded Hand',
    description: 'Begin every turn with one extra fair die.',
    modifyDice: (diceCount) => diceCount + 1,
  },
  {
    id: 'golden-one',
    name: 'Golden One',
    description: 'Once each turn, turn one newly rolled die into a one.',
    activeAbility: 'golden-one',
  },
  {
    id: 'double-down',
    name: 'Double Down',
    description: 'Once each game, double the score of a valid selection.',
    activeAbility: 'double-down',
  },
]

export function getModifiers(ids: string[]): GameModifier[] {
  return ids.map((id) => MODIFIERS.find((modifier) => modifier.id === id)).filter(Boolean) as GameModifier[]
}

export function getTurnDiceCount(ids: string[], baseDiceCount = 6): number {
  return getModifiers(ids).reduce(
    (diceCount, modifier) => modifier.modifyDice?.(diceCount) ?? diceCount,
    baseDiceCount,
  )
}

export function hasModifier(ids: string[], id: string): boolean {
  return ids.includes(id)
}

export function hasActiveAbility(
  ids: string[],
  ability: NonNullable<GameModifier['activeAbility']>,
): boolean {
  return getModifiers(ids).some((modifier) => modifier.activeAbility === ability)
}

export function shouldPreventBust(ids: string[], usage: ModifierUsage): boolean {
  return getModifiers(ids).some((modifier) => modifier.onBust?.(usage) === true)
}

export function applyScoreModifiers(ids: string[], score: number): number {
  return getModifiers(ids).reduce(
    (currentScore, modifier) => modifier.modifyScore?.(currentScore) ?? currentScore,
    score,
  )
}
