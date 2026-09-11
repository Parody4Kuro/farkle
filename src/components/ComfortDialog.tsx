import { AccessibleDialog } from './AccessibleDialog'
import type { ComfortPreferences } from '../storage/adventureStorage'

export function ComfortDialog({ value, onChange, onClose, appearanceUnlocked, volume, onVolume }: {
  value: ComfortPreferences; onChange: (next: ComfortPreferences) => void; onClose: () => void
  appearanceUnlocked: boolean; volume?: number; onVolume?: (volume: number) => void
}) {
  return <AccessibleDialog ariaLabelledBy="comfort-heading" onClose={onClose}>
    <section className="comfort-panel">
      <button className="modal-close" aria-label="关闭偏好设置" onClick={onClose}>×</button>
      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
      <h2 id="comfort-heading" tabIndex={-1} data-autofocus>按你的节奏来</h2>
      <p>这些偏好即时生效，保存在这台设备上。</p>
      <label><span>快速演出<small>缩短翻滚与对手思考，保留每次选择。</small></span><input type="checkbox" checked={value.fast} onChange={(e) => onChange({ ...value, fast: e.target.checked })} /></label>
      <label><span>人物对白<small>关闭后跳过重复对白，保留规则提示。</small></span><input type="checkbox" checked={value.dialogue} onChange={(e) => onChange({ ...value, dialogue: e.target.checked })} /></label>
      <label><span>较大字号</span><input type="checkbox" checked={value.largeText} onChange={(e) => onChange({ ...value, largeText: e.target.checked })} /></label>
      {onVolume && <label><span>主音量 · {Math.round((volume ?? 0.6) * 100)}%</span><input aria-label="主音量" type="range" min="0" max="100" value={(volume ?? 0.6) * 100} onChange={(e) => onVolume(Number(e.target.value) / 100)} /></label>}
      <label><span>酒馆环境 · {Math.round(value.environment * 100)}%</span><input aria-label="环境音量" type="range" min="0" max="100" value={value.environment * 100} onChange={(e) => onChange({ ...value, environment: Number(e.target.value) / 100 })} /></label>
      <label><span>音乐 · {Math.round(value.music * 100)}%</span><input aria-label="音乐音量" type="range" min="0" max="100" value={value.music * 100} onChange={(e) => onChange({ ...value, music: Number(e.target.value) / 100 })} /></label>
      <label><span>骰盅与窗光</span><select value={value.appearance} onChange={(e) => onChange({ ...value, appearance: e.target.value as ComfortPreferences['appearance'] })}>
        <option value="copper">铜色旧梦</option><option value="moon" disabled={!appearanceUnlocked}>{appearanceUnlocked ? '月下归客' : '月下归客 · 通关后解锁'}</option>
      </select></label>
      <button className="night-primary" onClick={onClose}>回到酒馆</button>
    </section>
  </AccessibleDialog>
}
