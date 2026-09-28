import type { PresentationPreferences } from '../presentation/ActionPlayback'

export function PresentationOptions<T extends PresentationPreferences>({ value, onChange }: { value: T; onChange: (value: T) => void }) {
  return <fieldset className="presentation-options"><legend>画面与演出</legend>
    <label><span>快速演出<small>缩短动作，保留每次结果。</small></span><input type="checkbox" checked={value.fast} onChange={(e) => onChange({ ...value, fast: e.target.checked })} /></label>
    <label><span>电影镜头<small>投掷特写与对手反应；选骰时保持稳定。</small></span><input type="checkbox" checked={value.cinematic} onChange={(e) => onChange({ ...value, cinematic: e.target.checked })} /></label>
    <label><span>减少动态效果<small>直接显示结果；系统偏好优先。</small></span><input type="checkbox" checked={value.reducedMotion} onChange={(e) => onChange({ ...value, reducedMotion: e.target.checked })} /></label>
    <label><span>画质</span><select aria-label="画质" value={value.quality} onChange={(e) => onChange({ ...value, quality: e.target.value as PresentationPreferences['quality'] })}><option value="auto">自动</option><option value="high">精细</option><option value="low">流畅</option></select></label>
  </fieldset>
}
