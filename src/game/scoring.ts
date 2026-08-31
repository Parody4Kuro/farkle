import { JOKER, type DiceValue, type DieFace, type ScoreGroup, type ScoreResult, type SelectionValidation } from './types'

interface SearchResult {
  score: number
  groups: ScoreGroup[]
  usedMask: number
}

const STRAIGHTS: Array<{ sequence: DieFace[]; score: number; label: string }> = [
  { sequence: [1, 2, 3, 4, 5, 6], score: 1500, label: 'Grand straight' },
  { sequence: [2, 3, 4, 5, 6], score: 750, label: 'High straight' },
  { sequence: [1, 2, 3, 4, 5], score: 500, label: 'Low straight' },
]

function kindScore(face: DieFace, count: number): number {
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
    if (value === 1 || value === 5) {
      add({
        kind: 'single',
        score: value === 1 ? 100 : 50,
        values: [value],
        dieIndices: [index],
        label: `Single ${value}`,
      })
    }
  })

  for (let mask = 1; mask < maxMask; mask += 1) {
    const indices = indicesForMask(mask, dice.length)
    const values = indices.map((index) => dice[index])

    if (indices.length >= 3) {
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

    for (const straight of STRAIGHTS) {
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

function searchBest(dice: DiceValue[], requireAll: boolean): SearchResult {
  const groups = enumerateScoringGroups(dice).map((group) => ({
    ...group,
    mask: group.dieIndices.reduce((mask, index) => mask | (1 << index), 0),
  }))
  const fullMask = (1 << dice.length) - 1
  const memo = new Map<number, SearchResult | null>()

  const visit = (usedMask: number): SearchResult | null => {
    const cached = memo.get(usedMask)
    if (cached !== undefined) return cached

    let best: SearchResult | null = requireAll
      ? (usedMask === fullMask ? { score: 0, groups: [], usedMask } : null)
      : { score: 0, groups: [], usedMask }

    for (const group of groups) {
      if (group.mask & usedMask) continue
      const next = visit(usedMask | group.mask)
      if (!next) continue
      const { mask: _mask, ...plainGroup } = group
      const candidate: SearchResult = {
        score: group.score + next.score,
        groups: [plainGroup, ...next.groups],
        usedMask: next.usedMask,
      }
      if (!best || isBetter(candidate, best)) best = candidate
    }

    memo.set(usedMask, best)
    return best
  }

  return visit(0) ?? { score: 0, groups: [], usedMask: 0 }
}

export function calculateBestScore(dice: DiceValue[]): ScoreResult {
  const result = searchBest(dice, false)
  const unusedIndices = dice.map((_, index) => index).filter((index) => !(result.usedMask & (1 << index)))
  return {
    score: result.score,
    groups: result.groups,
    unusedIndices,
    unusedDice: unusedIndices.map((index) => dice[index]),
  }
}

export const calculateScore = calculateBestScore

export function validateSelectedDice(dice: DiceValue[]): SelectionValidation {
  if (dice.length === 0) {
    return { valid: false, score: 0, groups: [], unusedDice: [], unusedIndices: [] }
  }

  const result = searchBest(dice, true)
  const allUsed = result.usedMask === (1 << dice.length) - 1 && result.score > 0
  if (allUsed) {
    return { valid: true, score: result.score, groups: result.groups, unusedDice: [], unusedIndices: [] }
  }

  return { valid: false, ...calculateBestScore(dice) }
}

export function hasAnyScore(dice: DiceValue[]): boolean {
  return calculateBestScore(dice).score > 0
}

export function bestScoringIndices(dice: DiceValue[]): number[] {
  const result = calculateBestScore(dice)
  return [...new Set(result.groups.flatMap((group) => group.dieIndices))].sort((a, b) => a - b)
}
