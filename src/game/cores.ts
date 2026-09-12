import type { GameModifier, ScoreGroup } from './types'
import { isScoringVersion, LEGACY_SCORING_VERSION, SCORING_VERSION } from './scoringVersions'

export { SCORING_VERSION } from './scoringVersions'

function coreScore(group: ScoreGroup, version: number, scale: (group: ScoreGroup) => number): number {
  if (!isScoringVersion(version)) throw new RangeError('Unsupported scoring version')
  return group.score * scale(group)
}

/** Released rules remain available for nights already in progress. */
const LEGACY_CORE_MODIFIERS: GameModifier[] = [
  {
    id: 'core-steady', name: '铜筹账簿', symbol: 'Ⅰ', category: 'core', adventureOnly: true,
    benefit: '单颗 1、5 得分翻倍', cost: '同点组合与顺子得分减半',
    description: '单骰稳收：单颗 1、5 得分翻倍，同点组合与顺子得分减半。',
    example: '三个 1 可拆成 200 + 200 + 200，比三同的 500 分更高。',
    modifyGroup: (group, { version }) => coreScore(group, version, (g) => g.kind === 'single' ? 2 : 0.5),
  },
  {
    id: 'core-kindred', name: '同契纹章', symbol: 'Ⅲ', category: 'core', adventureOnly: true,
    benefit: '三至六同得分增加 50%', cost: '单骰与顺子得分减半',
    description: '同点爆发：三至六同得分增加 50%，单骰与顺子得分减半。',
    example: '三个 5 得 750 分；单颗 5 只得 25 分。',
    modifyGroup: (group, { version }) => coreScore(group, version, (g) => g.kind === 'kind' ? 1.5 : 0.5),
  },
  {
    id: 'core-wanderer', name: '歧路罗盘', symbol: '◇', category: 'core', adventureOnly: true,
    benefit: '顺子得分三倍，含 Joker 的同点组合得分翻倍', cost: '不含 Joker 的同点组合得分减少 25%',
    description: '顺子与补位：顺子得分三倍，含 Joker 的同点组合得分翻倍；其他同点组合减少 25%，单骰不变。',
    example: '1–5 顺子得 1500 分；3、3、Joker 得 600 分，三个 3 得 225 分。单颗 Joker 仍不能计分。',
    modifyGroup: (group, { version }) => coreScore(group, version, (g) => g.kind === 'straight' ? 3 : g.kind === 'kind' ? g.jokerAs?.length ? 2 : 0.75 : 1),
  },
]

export const CORE_MODIFIERS: GameModifier[] = LEGACY_CORE_MODIFIERS.map((core) => core.id === 'core-steady' ? {
  ...core,
  maxSinglesPerFace: 2,
  cost: '同点组合与顺子得分减半，同一点数最多按两颗单骰计分',
  description: '单颗 1、5 得分翻倍，同点组合与顺子得分减半。同一次选择中，同一点数最多按两颗单骰计分，其余须组成同点组合或顺子。',
  example: '三个 1 按三同计 1000 × 0.5 = 500 分，三个 5 得 250 分；只选两颗 1 仍得 400 分。',
} : core)

export function getCoreModifiers(version: number = SCORING_VERSION): GameModifier[] {
  if (!isScoringVersion(version)) throw new RangeError('Unsupported scoring version')
  return version === LEGACY_SCORING_VERSION ? LEGACY_CORE_MODIFIERS : CORE_MODIFIERS
}

export const CORE_IDS = CORE_MODIFIERS.map((core) => core.id)
