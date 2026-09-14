import { useState } from 'react'
import type { AdventureRun } from '../game/adventure'
import { loadoutError } from '../game/inventory'
import { LEGACY_SCORING_VERSION } from '../game/scoringVersions'
import { LoadoutEditor } from './LoadoutEditor'

export function LoadoutPanel({ run, onSit }: { run: AdventureRun; onSit: (loadout: string[], modifiers: string[]) => void }) {
  const [draft, setDraft] = useState(() => ({ dice: [...run.loadout], modifiers: [...run.modifiers] }))
  const error = loadoutError(run.inventory, draft.dice, draft.modifiers)
  return <form id="prepare-table" className="loadout-panel" aria-label="入座前整理行囊" onSubmit={(event) => { event.preventDefault(); if (!error) onSit([...draft.dice], [...draft.modifiers]) }}>
    <span className="eyebrow">PACK FOR THIS TABLE</span><h2>整理骰盅与徽章</h2>
    {run.scoringVersion === LEGACY_SCORING_VERSION && <p>本夜沿用旧版计分；新开的一夜采用新规则。</p>}
    <LoadoutEditor value={draft} inventory={run.inventory} badgeLimit={2} scoringVersion={run.scoringVersion} onChange={setDraft} />
    <small className="inventory-summary">行囊共 {Object.values(run.inventory.dice).reduce((a, b) => a + b, 0)} 颗骰子、{run.inventory.modifiers.length} 枚徽章</small>
    {error && <p role="alert">{error}</p>}
    <button className="night-primary" type="submit" disabled={!!error}>入座，开始这一桌 <span aria-hidden="true">→</span></button>
  </form>
}
