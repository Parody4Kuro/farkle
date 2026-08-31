import { JOKER, type DiceValue, type DieDefinition, type DieFace, type DieInstance } from './types'

export const DIE_DEFINITIONS: DieDefinition[] = [
  {
    id: 'standard',
    name: '公平骰',
    weights: [1, 1, 1, 1, 1, 1],
    description: '每个点数出现的概率完全相同。',
  },
  {
    id: 'lucky-one',
    name: '幸运一点',
    weights: [5, 1, 1, 1, 1, 1],
    description: '经过巧妙配重，更容易掷出 1。',
  },
  {
    id: 'lucky-five',
    name: '工匠之五',
    weights: [1, 1, 1, 1, 5, 1],
    description: '更容易掷出可以单独计分的 5。',
  },
  {
    id: 'high-roller',
    name: '高地骰',
    weights: [1, 1, 1, 2, 3, 4],
    description: '倾向于掷出 4、5、6 等高点数。',
  },
  {
    id: 'odd-fellow',
    name: '奇数伙伴',
    weights: [3, 1, 3, 1, 3, 1],
    description: '倾向于掷出 1、3、5 等奇数。',
  },
  {
    id: 'joker',
    name: 'Joker 骰',
    weights: [1, 1, 1, 1, 1, 1],
    jokerFace: 6,
    description: '骷髅面可以补全同点数组合或顺子。',
  },
]

export const DEFAULT_LOADOUT = Array<string>(6).fill('standard')

export function getDieDefinition(id: string): DieDefinition {
  return DIE_DEFINITIONS.find((definition) => definition.id === id) ?? DIE_DEFINITIONS[0]
}

export function weightedRandomFace(
  weights: DieDefinition['weights'],
  random: () => number = Math.random,
): DieFace {
  const safeWeights = weights.map((weight) => Math.max(0, weight))
  const total = safeWeights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 1
  let cursor = random() * total
  for (let index = 0; index < safeWeights.length; index += 1) {
    cursor -= safeWeights[index]
    if (cursor < 0) return (index + 1) as DieFace
  }
  return 6
}

export function rollDie(definition: DieDefinition, random: () => number = Math.random): DiceValue {
  const face = weightedRandomFace(definition.weights, random)
  return definition.jokerFace === face ? JOKER : face
}

export function rollDice(
  definitionIds: string[],
  count: number,
  random: () => number = Math.random,
  idFactory: () => string = () => crypto.randomUUID(),
): DieInstance[] {
  return Array.from({ length: count }, (_, index) => {
    const definitionId = definitionIds[index % definitionIds.length] ?? 'standard'
    const definition = getDieDefinition(definitionId)
    return {
      id: idFactory(),
      definitionId,
      value: rollDie(definition, random),
      selected: false,
    }
  })
}
