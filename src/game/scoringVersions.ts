export const LEGACY_SCORING_VERSION = 1
export const SCORING_VERSION = 2
export type ScoringVersion = typeof LEGACY_SCORING_VERSION | typeof SCORING_VERSION

export function isScoringVersion(value: unknown): value is ScoringVersion {
  return value === LEGACY_SCORING_VERSION || value === SCORING_VERSION
}
