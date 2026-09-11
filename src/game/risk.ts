import { getDieDefinition } from './dice'
import { enumerateScoringGroups } from './scoring'
import { JOKER, type DiceValue, type GameState } from './types'
import { getTurnDiceCount } from './modifiers'

const cache = new Map<string, number>()
const scoreable = new Map<string, boolean>()

/** Exact distribution over face counts, not 6^n ordered rolls. Uses the same legal groups as scoring. */
export function bustProbability(definitionIds: string[]): number {
  if (!definitionIds.length) return 0
  const key = [...definitionIds].sort().join('|')
  const known = cache.get(key)
  if (known !== undefined) return known
  let distribution = new Map<string, number>([['0000000', 1]])
  for (const id of definitionIds) {
    const die = getDieDefinition(id)
    const total = die.weights.reduce((a, b) => a + Math.max(0, b), 0)
    const next = new Map<string, number>()
    for (const [counts, probability] of distribution) {
      die.weights.forEach((weight, face) => {
        const p = total > 0 ? Math.max(0, weight) / total : Number(face === 0)
        if (!p) return
        const index = die.jokerFace === face + 1 ? 6 : face
        const updated = counts.slice(0, index) + (Number(counts[index]) + 1) + counts.slice(index + 1)
        next.set(updated, (next.get(updated) ?? 0) + probability * p)
      })
    }
    distribution = next
  }
  let bust = 0
  for (const [counts, p] of distribution) {
    let valid = scoreable.get(counts)
    if (valid === undefined) {
      const values: DiceValue[] = [...counts].flatMap((count, face) => Array<DiceValue>(Number(count)).fill(face === 6 ? JOKER : face + 1 as DiceValue))
      valid = enumerateScoringGroups(values).length > 0
      scoreable.set(counts, valid)
    }
    if (!valid) bust += p
  }
  cache.set(key, bust)
  return bust
}

export function nextHumanLoadout(state: GameState): string[] {
  const remaining = state.rolledDice.filter((die) => !die.selected)
  if (remaining.length) return remaining.map((die) => die.definitionId)
  return Array.from({ length: getTurnDiceCount(state.config.modifierIds) }, (_, i) => state.config.dieLoadout[i] ?? 'standard')
}
