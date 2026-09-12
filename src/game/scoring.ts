import { applyGroupModifiers, getSingleDiceLimit } from './modifiers'
import { JOKER, type DiceValue, type DieFace, type ScoreGroup, type ScoreResult, type SelectionValidation, type ScoringContext } from './types'

interface SearchResult {
  score: number
  groups: ScoreGroup[]
  usedMask: number
}

export const STRAIGHT_RULES: Array<{ sequence: DieFace[]; score: number; label: string }> = [
  { sequence: [1, 2, 3, 4, 5, 6], score: 1500, label: 'Grand straight' },
  { sequence: [2, 3, 4, 5, 6], score: 750, label: 'High straight' },
  { sequence: [1, 2, 3, 4, 5], score: 500, label: 'Low straight' },
]

export const SINGLE_SCORES: Partial<Record<DieFace, number>> = { 1: 100, 5: 50 }
export const MIN_KIND_DICE = 3
export const MAX_KIND_DICE = 6

export function kindScore(face: DieFace, count: number): number {
  if (count < MIN_KIND_DICE || count > MAX_KIND_DICE) return 0
  const triple = face === 1 ? 1000 : face * 100
  return triple * 2 ** (count - 3)
}

function bitCount(mask: number): number {
  let count = 0
  while (mask) {
    count += mask & 1
    mask >>>= 1
  }
  return count
}

function indicesForMask(mask: number, length: number): number[] {
  return Array.from({ length }, (_, index) => index).filter((index) => mask & (1 << index))
}

function groupKey(group: ScoreGroup): string {
  return `${group.kind}:${group.dieIndices.join(',')}:${group.jokerAs?.join(',') ?? ''}`
}

export function enumerateScoringGroups(dice: DiceValue[]): ScoreGroup[] {
  const groups: ScoreGroup[] = []
  const seen = new Set<string>()
  const maxMask = 1 << dice.length

  const add = (group: ScoreGroup) => {
    const key = groupKey(group)
    if (!seen.has(key)) {
      seen.add(key)
      groups.push(group)
    }
  }

  dice.forEach((value, index) => {
    const singleScore = value === JOKER ? undefined : SINGLE_SCORES[value]
    if (singleScore) {
      add({
        kind: 'single',
        score: singleScore,
        values: [value],
        dieIndices: [index],
        label: `Single ${value}`,
      })
    }
  })

  for (let mask = 1; mask < maxMask; mask += 1) {
    const indices = indicesForMask(mask, dice.length)
    const values = indices.map((index) => dice[index])

    if (indices.length >= MIN_KIND_DICE && indices.length <= MAX_KIND_DICE) {
      for (let face = 1 as DieFace; face <= 6; face = (face + 1) as DieFace) {
        if (values.every((value) => value === JOKER || value === face)) {
          const jokerCount = values.filter((value) => value === JOKER).length
          add({
            kind: 'kind',
            score: kindScore(face, indices.length),
            values,
            dieIndices: indices,
            label: `${indices.length} × ${face}`,
            jokerAs: jokerCount ? Array<DieFace>(jokerCount).fill(face) : undefined,
          })
        }
      }
    }

    for (const straight of STRAIGHT_RULES) {
      if (indices.length !== straight.sequence.length) continue
      const fixed = values.filter((value): value is DieFace => value !== JOKER)
      const fixedSet = new Set(fixed)
      const allInside = fixed.every((value) => straight.sequence.includes(value))
      const noDuplicates = fixedSet.size === fixed.length
      const missing = straight.sequence.filter((value) => !fixedSet.has(value))
      const jokerCount = values.length - fixed.length

      if (allInside && noDuplicates && missing.length === jokerCount) {
        add({
          kind: 'straight',
          score: straight.score,
          values,
          dieIndices: indices,
          label: straight.label,
          jokerAs: jokerCount ? missing : undefined,
        })
      }
    }
  }

  return groups.sort((a, b) => b.score - a.score || b.dieIndices.length - a.dieIndices.length)
}

export const findScoringOptions = enumerateScoringGroups

function isBetter(candidate: SearchResult, current: SearchResult): boolean {
  if (candidate.score !== current.score) return candidate.score > current.score
  const candidateUsed = bitCount(candidate.usedMask)
  const currentUsed = bitCount(current.usedMask)
  if (candidateUsed !== currentUsed) return candidateUsed > currentUsed
  return candidate.groups.length < current.groups.length
}

function kindFace(group: ScoreGroup): DieFace | undefined {
  if (group.kind !== 'kind') return undefined
  return group.jokerAs?.[0] ?? (group.values.find((value): value is DieFace => value !== JOKER))
}

function searchBest(dice: DiceValue[], requireAll: boolean, context?: ScoringContext): SearchResult {
  const singleLimit = getSingleDiceLimit(context)
  const groups = enumerateScoringGroups(dice).map((group) => ({
    ...applyGroupModifiers(group, context),
    mask: group.dieIndices.reduce((mask, index) => mask | (1 << index), 0),
  }))
  const fullMask = (1 << dice.length) - 1
  const memo = new Map<string, SearchResult | null>()

  const visit = (usedMask: number, usedKindFaces = 0, singleCounts = [0, 0, 0, 0, 0, 0]): SearchResult | null => {
    // The same used dice can have been consumed by singles or by a straight.
    // Remaining single allowances therefore belong in the memo key.
    const memoKey = `${usedMask}:${usedKindFaces}:${singleLimit < Infinity ? singleCounts.join(',') : ''}`
    const cached = memo.get(memoKey)
    if (cached !== undefined) return cached

    let best: SearchResult | null = requireAll
      ? (usedMask === fullMask ? { score: 0, groups: [], usedMask } : null)
      : { score: 0, groups: [], usedMask }

    for (const group of groups) {
      if (group.mask & usedMask) continue
      const face = kindFace(group)
      const faceBit = face ? 1 << face : 0
      if (faceBit && usedKindFaces & faceBit) continue
      let nextSingles = singleCounts
      if (group.kind === 'single' && singleLimit < Infinity) {
        const singleFace = group.values[0] as DieFace
        if (singleCounts[singleFace - 1] >= singleLimit) continue
        nextSingles = [...singleCounts]
        nextSingles[singleFace - 1] += 1
      }
      const next = visit(usedMask | group.mask, usedKindFaces | faceBit, nextSingles)
      if (!next) continue
      const { mask: _mask, ...plainGroup } = group
      const candidate: SearchResult = {
        score: group.score + next.score,
        groups: [plainGroup, ...next.groups],
        usedMask: next.usedMask,
      }
      if (!best || isBetter(candidate, best)) best = candidate
    }

    memo.set(memoKey, best)
    return best
  }

  return visit(0) ?? { score: 0, groups: [], usedMask: 0 }
}

export function calculateBestScore(dice: DiceValue[], context?: ScoringContext): ScoreResult {
  const result = searchBest(dice, false, context)
  const unusedIndices = dice.map((_, index) => index).filter((index) => !(result.usedMask & (1 << index)))
  return {
    score: result.score,
    groups: result.groups,
    unusedIndices,
    unusedDice: unusedIndices.map((index) => dice[index]),
  }
}

export const calculateScore = calculateBestScore

export function validateSelectedDice(dice: DiceValue[], context?: ScoringContext): SelectionValidation {
  if (dice.length === 0) {
    return { valid: false, score: 0, groups: [], unusedDice: [], unusedIndices: [] }
  }

  const result = searchBest(dice, true, context)
  const allUsed = result.usedMask === (1 << dice.length) - 1 && result.score > 0
  if (allUsed) {
    return { valid: true, score: result.score, groups: result.groups, unusedDice: [], unusedIndices: [] }
  }

  return { valid: false, ...calculateBestScore(dice, context) }
}

export function hasAnyScore(dice: DiceValue[]): boolean {
  return calculateBestScore(dice).score > 0
}

export function bestScoringIndices(dice: DiceValue[]): number[] {
  const result = calculateBestScore(dice)
  return [...new Set(result.groups.flatMap((group) => group.dieIndices))].sort((a, b) => a - b)
}
