import { useState } from 'react'
import type { AdventureRun } from '../game/adventure'
import { getDieDefinition } from '../game/dice'
import { loadoutError } from '../game/inventory'
import { getModifier } from '../game/modifiers'

export function LoadoutPanel({ run, onSit }: { run: AdventureRun; onSit: (loadout: string[], modifiers: string[]) => void }) {
  const [dice, setDice] = useState(() => [...run.loadout])
  const [badges, setBadges] = useState(() => [run.modifiers[0] ?? '', run.modifiers[1] ?? ''])
  const modifiers = badges.filter(Boolean)
  const error = loadoutError(run.inventory, dice, modifiers)
  const owned = Object.entries(run.inventory.dice)
  return <form id="prepare-table" className="loadout-panel" aria-label="入座前整理行囊" onSubmit={(event) => {
    event.preventDefault()
    if (!error) onSit([...dice], [...modifiers])
  }}>
    <span className="eyebrow">PACK FOR THIS TABLE</span><h2>整理骰盅与徽章</h2>
    <p>未装备的物品仍在行囊中。入座后，这一桌的搭配就固定了。下拉框也可按选项前的数字快速选择。</p>
    <fieldset><legend>骰盅 · 六颗</legend><div className="loadout-slots">{dice.map((id, slot) => <label key={slot}>骰子 {slot + 1}
      <select value={id} onChange={(e) => setDice((current) => current.map((d, i) => i === slot ? e.target.value : d))}>
        {owned.map(([option, count], index) => <option key={option} value={option} disabled={option !== id && dice.filter((d) => d === option).length >= count}>
          {index + 1} · {getDieDefinition(option).name} · 持有 {count}
        </option>)}
      </select><small title={getDieDefinition(id).description}>{id === 'standard' ? '各面等概率' : getDieDefinition(id).description}</small>
    </label>)}</div></fieldset>
    <fieldset><legend>徽章 · 最多两枚，其中核心最多一枚</legend><div className="badge-slots">{badges.map((id, slot) => <label key={slot}>徽章 {slot + 1}
      <select value={id} onChange={(e) => setBadges((current) => current.map((b, i) => i === slot ? e.target.value : b))}>
        <option value="">0 · 留空</option>{run.inventory.modifiers.map((option, index) => {
          const badge = getModifier(option)!
          const other = badges[1 - slot]
          return <option key={option} value={option} disabled={other === option || (badge.category === 'core' && getModifier(other)?.category === 'core')}>
            {index + 1} · {badge.name}{badge.category === 'core' ? ' · 核心' : ''}
          </option>
        })}
      </select><small>{getModifier(id)?.description ?? '空位可在获得徽章后使用。'}</small>
    </label>)}</div></fieldset>
    <p className="inventory-summary">行囊共 {owned.reduce((n, [, count]) => n + count, 0)} 颗骰子、{run.inventory.modifiers.length} 枚徽章 · 已装备物品计入持有量</p>
    {error && <p role="alert">{error}</p>}
    <button className="night-primary" type="submit" disabled={!!error}>入座，开始这一桌 <span aria-hidden="true">→</span></button>
  </form>
}
