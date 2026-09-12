import { useMemo } from 'react'
import { findBustProtector } from '../game/modifiers'
import { bustProbability, nextHumanLoadout } from '../game/risk'
import { evaluateSelection } from '../game/selection'
import type { GameState, ScoreGroup } from '../game/types'

function groupLabel(group: ScoreGroup): string {
  if (group.kind === 'single') return `单颗 ${group.values[0]}`
  if (group.kind === 'straight') return group.values.length === 6 ? '六骰大顺' : group.label === 'Low straight' ? '低顺 1–5' : '高顺 2–6'
  return `${group.values.length} 同点 ${group.jokerAs?.[0] ?? group.values.find((v) => v !== 'JOKER')}`
}

export function ScoreExplanation({ state }: { state: GameState }) {
  const choice = useMemo(() => evaluateSelection(state), [state])
  const selected = choice.selectedDice
  const ids = useMemo(() => nextHumanLoadout(state), [state])
  const risk = useMemo(() => bustProbability(ids), [ids])
  const human = state.currentPlayer === 'human'
  const canSee = human && (state.phase === 'selecting' || state.phase === 'ready')
  const protector = findBustProtector(state.config.modifierIds, state.modifierUsage)
  return <div className="decision-ledger">
    <div className="score-explanation" aria-label="计分明细">
      <span className="ledger-label">这一手的账</span>
      {selected.length === 0 ? <p className="ledger-hint">{human ? '选中骰子后，在这里查看组合与得分。' : '观察对手的选择，下一回合就轮到你。'}</p>
        : <><div className="score-groups">{choice.groups.map((group, i) => <span key={i}>{groupLabel(group)} <b>+{group.score}</b>
          {group.adjustments?.map((adjustment) => <small key={adjustment.modifierId}>{adjustment.label}：基础 {group.baseScore} {adjustment.amount > 0 ? '+' : '−'} {Math.abs(adjustment.amount)}</small>)}
          {group.jokerAs?.length ? <small> 骷髅 → {group.jokerAs.join('、')}</small> : null}</span>)}
          {choice.valid && choice.totalAdjustment !== 0 && <span>徽章调整 <b>{choice.totalAdjustment > 0 ? '+' : '−'}{Math.abs(choice.totalAdjustment)}</b></span>}
          {choice.valid && choice.doubleBonus > 0 && <span>孤注一掷 <b>+{choice.doubleBonus}</b></span>}</div>
          {!choice.valid && <p className="selection-error">选择尚未完整计分：请调整 {choice.unusedDice.map((v) => v === 'JOKER' ? '骷髅' : v).join('、')}。</p>}
          {choice.valid && human && <p className="bank-total">本回合 {state.turnScore} + 本次 {choice.score} <span>可落袋 <b>{choice.bankTotal}</b></span></p>}</>}
    </div>
    <div className="exact-risk" aria-label="下一投风险">
      <span className="ledger-label">下一投 · {canSee ? `${ids.length} 颗骰子` : '等待选择'}</span>
      <strong>{canSee ? `${(risk * 100).toFixed(1)}%` : '—'} <small>爆骰概率</small></strong>
      <span className="risk-track" aria-hidden="true"><i style={{ width: `${risk * 100}%` }} /></span>
      <small>{protector ? '☘ 护符可免除一次爆骰，并重投' : '爆骰将失去本回合全部临时分'}</small>
    </div>
  </div>
}
