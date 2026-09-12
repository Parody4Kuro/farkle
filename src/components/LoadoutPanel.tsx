import { useState } from 'react'
import type { AdventureRun } from '../game/adventure'
import { DEFAULT_LOADOUT, getDieDefinition } from '../game/dice'
import { createInventory, loadoutError } from '../game/inventory'
import { getModifier } from '../game/modifiers'
import { LEGACY_SCORING_VERSION } from '../game/scoringVersions'

export function LoadoutPanel({ run, onSit }: { run: AdventureRun; onSit: (loadout: string[], modifiers: string[]) => void }) {
  const [dice, setDice] = useState(() => [...run.loadout])
  const [badges, setBadges] = useState(() => [run.modifiers[0] ?? '', run.modifiers[1] ?? ''])
  const modifiers = badges.filter(Boolean)
  const error = loadoutError(run.inventory, dice, modifiers)
  const equipped = createInventory(dice).dice
  const owned = Object.entries(run.inventory.dice).sort(([a], [b]) => a === 'standard' ? -1 : b === 'standard' ? 1 : 0)
  const badgeDefinition = (id: string) => getModifier(id, run.scoringVersion)
  const badgeReason = (id: string, other: string) => other === id ? '另一槽位已佩戴'
    : badgeDefinition(id)?.category === 'core' && badgeDefinition(other)?.category === 'core' ? '核心最多一枚' : ''
  return <form id="prepare-table" className="loadout-panel" aria-label="入座前整理行囊" onSubmit={(event) => {
    event.preventDefault()
    if (!error) onSit([...dice], [...modifiers])
  }}>
    <span className="eyebrow">PACK FOR THIS TABLE</span><h2>整理骰盅与徽章</h2>
    <p>每夜保有六颗基础公平骰。特殊骰和换下的物品都留在行囊中，入座后固定本桌搭配。下拉框可按选项前的数字快速选择。</p>
    {run.scoringVersion === LEGACY_SCORING_VERSION && <p className="scoring-version-note">本夜沿用旧版计分：铜筹账簿的三个 1 仍得 600 分。新开的一夜采用 500 分的新规则。</p>}
    <fieldset><legend>骰盅 · 六颗</legend>
      <button className="loadout-reset" type="button" disabled={dice.every((id) => id === 'standard')}
        onClick={() => setDice([...DEFAULT_LOADOUT])}>全部换回公平骰</button>
      <div className="loadout-slots">{dice.map((id, slot) => <div key={slot} className="loadout-slot">
        <label htmlFor={`loadout-die-${slot}`}>骰子 {slot + 1}</label>
        <select id={`loadout-die-${slot}`} aria-describedby={`loadout-die-info-${slot}`} value={id} onChange={(event) => {
          const value = event.currentTarget.value
          setDice((current) => current.map((die, i) => i === slot ? value : die))
        }}>
          {owned.map(([option, count], index) => {
            const used = equipped[option] ?? 0
            const unavailable = option !== id && used >= count
            return <option key={option} value={option} disabled={unavailable}>
              {index + 1} · {getDieDefinition(option).name} · 持有 {count} · 已装备 {used} · 空闲 {count - used}{unavailable ? ' · 全部已装备' : ''}
            </option>
          })}
        </select>
        <small id={`loadout-die-info-${slot}`}>持有 {run.inventory.dice[id]} · 已装备 {equipped[id]} · 空闲 {run.inventory.dice[id] - equipped[id]}<br />{id === 'standard' ? '各面等概率' : getDieDefinition(id).description}</small>
      </div>)}</div>
      <p className="loadout-help">特殊骰全部已装备时，先将原槽位换为公平骰，再装到其他槽位。</p>
    </fieldset>
    <fieldset><legend>徽章 · 最多两枚，其中核心最多一枚</legend>
      <div className="badge-slots">{badges.map((id, slot) => <div key={slot} className="loadout-slot">
        <label htmlFor={`loadout-badge-${slot}`}>徽章 {slot + 1}</label>
        <select id={`loadout-badge-${slot}`} aria-describedby={`loadout-badge-info-${slot}`} value={id} onChange={(event) => {
          const value = event.currentTarget.value
          setBadges((current) => current.map((badge, i) => i === slot ? value : badge))
        }}>
          <option value="">0 · 留空</option>{run.inventory.modifiers.map((option, index) => {
            const badge = badgeDefinition(option)!
            const reason = badgeReason(option, badges[1 - slot])
            return <option key={option} value={option} disabled={!!reason}>
              {index + 1} · {badge.name}{badge.category === 'core' ? ' · 核心' : ''}{reason ? ` · ${reason}` : ''}
            </option>
          })}
        </select>
        <button className="loadout-remove" type="button" disabled={!id} aria-label={`卸下徽章 ${slot + 1}`}
          onClick={() => setBadges((current) => current.map((badge, i) => i === slot ? '' : badge))}>卸下</button>
        <small id={`loadout-badge-info-${slot}`}>{badgeDefinition(id)?.description ?? '空位可在获得徽章后使用。'}</small>
      </div>)}</div>
      <p className="loadout-help">{run.inventory.modifiers.length === 1 ? '目前仅持有一枚徽章，可卸下或移位；赢得新徽章后可替换。' : '只能佩戴行囊中已有的徽章。'} 已在另一槽位佩戴的徽章需先卸下，再移到这里。</p>
    </fieldset>
    <p className="inventory-summary" role="status" aria-live="polite">行囊共 {owned.reduce((n, [, count]) => n + count, 0)} 颗骰子、{run.inventory.modifiers.length} 枚徽章 · 已装备 {dice.length} 颗骰子、{modifiers.length} 枚徽章</p>
    {error && <p role="alert">{error}</p>}
    <button className="night-primary" type="submit" disabled={!!error}>入座，开始这一桌 <span aria-hidden="true">→</span></button>
  </form>
}
