import { useId, useState } from 'react'
import { DEFAULT_LOADOUT, getDieDefinition } from '../game/dice'
import { getModifier } from '../game/modifiers'
import type { Inventory } from '../game/inventory'

export interface LoadoutDraft { dice: string[]; modifiers: string[] }
interface Props {
  value: LoadoutDraft
  inventory: Inventory
  badgeLimit: number
  coreLimit?: number
  scoringVersion?: number
  onChange: (value: LoadoutDraft) => void
  disabled?: boolean
}

/** Ownership and mode policy come from the caller; this editor only changes a draft. */
export function LoadoutEditor({ value, inventory, badgeLimit, coreLimit = 1, scoringVersion, onChange, disabled = false }: Props) {
  const uid = useId()
  const [target, setTarget] = useState<{ kind: 'die' | 'badge'; index: number } | null>(null)
  const [inspect, setInspect] = useState<{ kind: 'die' | 'badge'; id: string }>({ kind: 'die', id: value.dice[0] ?? 'standard' })
  const [slotView, setSlotView] = useState(value.modifiers)
  const sameBadges = slotView.filter(Boolean).join('|') === value.modifiers.filter(Boolean).join('|')
  const badges = Array.from({ length: badgeLimit }, (_, i) => (sameBadges ? slotView : value.modifiers)[i] ?? '')
  const item = inspect.kind === 'die' ? getDieDefinition(inspect.id) : getModifier(inspect.id, scoringVersion)
  const change = (dice: string[], modifiers: string[]) => { setSlotView(modifiers); onChange({ dice, modifiers: modifiers.filter(Boolean) }) }
  const chooseSlot = (kind: 'die' | 'badge', index: number) => {
    const items = kind === 'die' ? [...value.dice] : [...badges]
    setInspect({ kind, id: items[index] })
    if (target?.kind === kind && target.index !== index) {
      ;[items[target.index], items[index]] = [items[index], items[target.index]]
      change(kind === 'die' ? items : [...value.dice], kind === 'badge' ? items : badges)
      setTarget(null)
    } else setTarget(target?.kind === kind && target.index === index ? null : { kind, index })
  }
  const reason = (kind: 'die' | 'badge', id: string) => {
    if (!target || target.kind !== kind) return '先选择一个槽位'
    const items = kind === 'die' ? value.dice : badges
    if (kind === 'die') return items.filter((v, i) => v === id && i !== target.index).length >= inventory.dice[id] ? '已全部装备，可点选两个槽位交换' : ''
    if (id && items.some((v, i) => v === id && i !== target.index)) return '已佩戴，可点选两个槽位交换'
    if (getModifier(id)?.category === 'core' && items.filter((v, i) => i !== target.index && getModifier(v)?.category === 'core').length >= coreLimit) return '核心最多一枚，请选择现有核心槽位替换'
    return ''
  }
  const equip = (kind: 'die' | 'badge', id: string) => {
    if (disabled || !target || reason(kind, id)) return
    const items = kind === 'die' ? [...value.dice] : [...badges]
    items[target.index] = id
    change(kind === 'die' ? items : [...value.dice], kind === 'badge' ? items : badges)
    setInspect({ kind, id }); setTarget(null)
  }
  return <section className="loadout-editor" aria-label="骰盅与行囊" onKeyDown={(event) => {
    if (event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
    const element = event.target as HTMLElement
    if (element.matches('input,select,textarea')) return
    if (event.key === 'Escape') { setTarget(null); return }
    if (event.key.toLowerCase() === 'e' && element instanceof HTMLButtonElement) { event.preventDefault(); if (!event.repeat) element.click() }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const index = buttons.indexOf(element as HTMLButtonElement)
      if (index >= 0) { event.preventDefault(); buttons[(index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length]?.focus() }
    }
  }}>
    <div className="equipment-strip">
      <div className="equipment-title"><strong>你的骰盅 · 六颗</strong><button type="button" disabled={disabled || value.dice.every((id) => id === 'standard')} onClick={() => { change([...DEFAULT_LOADOUT], badges); setTarget(null) }}>全部换回公平骰</button></div>
      <div className="equipped-dice">{value.dice.map((id, index) => <button type="button" key={index} disabled={disabled} aria-label={`骰子 ${index + 1}：${getDieDefinition(id).name}`} aria-pressed={target?.kind === 'die' && target.index === index} onClick={() => chooseSlot('die', index)} onFocus={() => setInspect({ kind: 'die', id })}><small>{index + 1}</small><span aria-hidden="true">⚄</span><b>{getDieDefinition(id).name}</b></button>)}</div>
      <div className="equipped-badges" aria-label="已装备徽章">{badges.map((id, index) => <button key={index} type="button" disabled={disabled} aria-label={`徽章 ${index + 1}：${getModifier(id)?.name ?? '空位'}`} aria-pressed={target?.kind === 'badge' && target.index === index} onClick={() => chooseSlot('badge', index)} onFocus={() => setInspect({ kind: 'badge', id })}><span aria-hidden="true">{getModifier(id)?.symbol ?? '＋'}</span>{getModifier(id)?.name ?? '空徽章位'}</button>)}</div>
    </div>
    <p className="equipment-instruction" role="status">{target ? `正在替换${target.kind === 'die' ? '骰子' : '徽章'} ${target.index + 1} · 选择行囊物品，或点另一个同类槽位交换` : '选槽位，再选物品。点选两个同类槽位可交换。'}</p>
    <div className="bag-and-detail">
      <div className="bag-list" aria-label="行囊物品">
        <h3>骰子</h3>{Object.entries(inventory.dice).map(([id, count]) => <button type="button" key={id} data-item-id={id} data-item-kind="die" disabled={disabled} aria-disabled={Boolean(reason('die', id))} aria-describedby={`${uid}-detail`} onFocus={() => setInspect({ kind: 'die', id })} onMouseEnter={() => setInspect({ kind: 'die', id })} onClick={() => { setInspect({ kind: 'die', id }); equip('die', id) }}><span>{getDieDefinition(id).name}</span><small>已装 {value.dice.filter((v) => v === id).length} / {count}</small></button>)}
        <h3>徽章 · 最多 {badgeLimit} 枚</h3>{['', ...inventory.modifiers].map((id) => <button type="button" key={id} data-item-id={id} data-item-kind="badge" disabled={disabled} aria-disabled={Boolean(reason('badge', id))} aria-describedby={`${uid}-detail`} onFocus={() => setInspect({ kind: 'badge', id })} onMouseEnter={() => setInspect({ kind: 'badge', id })} onClick={() => { setInspect({ kind: 'badge', id }); equip('badge', id) }}><span>{getModifier(id)?.symbol} {getModifier(id)?.name ?? '卸下徽章'}</span><small>{badges.includes(id) && id ? '已佩戴' : getModifier(id)?.category === 'core' ? '核心' : ''}</small></button>)}
      </div>
      <aside className="item-detail" id={`${uid}-detail`}><span className="eyebrow">物品详情</span><h3>{item?.name ?? '空徽章位'}</h3><p>{item?.description ?? '可不佩戴徽章。'}</p>{inspect.kind === 'die' && <div className="face-probabilities">{getDieDefinition(inspect.id).weights.map((weight, i, weights) => <span key={i}>{getDieDefinition(inspect.id).jokerFace === i + 1 ? '☠' : i + 1}<b>{Math.round(weight / weights.reduce((a, b) => a + b, 0) * 100)}%</b></span>)}</div>}<p className="equipment-hint">{reason(inspect.kind, inspect.id)}</p></aside>
    </div>
  </section>
}
