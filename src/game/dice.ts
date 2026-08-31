import { JOKER, type DiceValue, type DieDefinition, type DieFace, type DieInstance } from './types'

export const DIE_DEFINITIONS: DieDefinition[] = [
  {
    id: 'standard',
    name: 'Fair Bone',
    weights: [1, 1, 1, 1, 1, 1],
    description: 'An honest die. Every face is equally likely.',
  },
  {
    id: 'lucky-one',
    name: "Saint's Favor",
    weights: [5, 1, 1, 1, 1, 1],
    description: 'A subtly weighted die that favors ones.',
  },
  {
    id: 'lucky-five',
    name: 'Tinker’s Five',
    weights: [1, 1, 1, 1, 5, 1],
    description: 'Frequently finds the valuable five.',
  },
  {
    id: 'high-roller',
    name: 'Highland Bone',
    weights: [1, 1, 1, 2, 3, 4],
    description: 'Leans toward high faces.',
  },
  {
    id: 'odd-fellow',
    name: 'Odd Fellow',
    weights: [3, 1, 3, 1, 3, 1],
    description: 'Favors odd faces: one, three, and five.',
  },
  {
    id: 'joker',
    name: 'Joker Die',
    weights: [1, 1, 1, 1, 1, 1],
    jokerFace: 6,
    description: 'Its skull face can complete a set or straight.',
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
