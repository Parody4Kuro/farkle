import { DIE_DEFINITIONS } from '../game/dice'
import { MODIFIERS } from '../game/modifiers'
import { TARGET_SCORE_OPTIONS } from '../game/rules'
import type { AudioPreferences, GameSettings } from '../game/types'
import { AccessibleDialog } from './AccessibleDialog'

interface SettingsModalProps {
  settings: GameSettings
  audioPreferences: AudioPreferences
  isFirstGame: boolean
  onUpdate: (updates: Partial<GameSettings>) => void
  onLoadoutChange: (index: number, definitionId: string) => void
  onToggleModifier: (modifierId: string) => void
  onToggleAudio: () => void
  onAudioVolumeChange: (volume: number) => void
  onStart: () => void
  onClose: () => void
}

const TARGET_LABELS: Record<number, string> = {
  2000: '快速局',
  4000: '标准局',
  6000: '长局',
  10000: '史诗局',
}

export function SettingsModal({
  settings,
  audioPreferences,
  isFirstGame,
  onUpdate,
  onLoadoutChange,
  onToggleModifier,
  onToggleAudio,
  onAudioVolumeChange,
  onStart,
  onClose,
}: SettingsModalProps) {
  return (
    <AccessibleDialog
      ariaLabelledBy="settings-heading"
      className="settings-dialog"
      dismissible={!isFirstGame}
      onClose={onClose}
    >
      <section className="settings-modal">
        {!isFirstGame && <button className="modal-close" type="button" aria-label="关闭设置" onClick={onClose}>×</button>}
        <span className="eyebrow">酒馆规矩</span>
        <h2 id="settings-heading" tabIndex={-1} data-autofocus>准备这张赌桌</h2>
        <p className="settings-intro">
          选择目标分、对手风格、骰组和徽章。游戏规则设置会保存到本机，并在开始新游戏时生效。
        </p>

        <div className="setting-grid">
          <label className="field">
            <span>获胜目标</span>
            <select value={settings.targetScore} onChange={(event) => onUpdate({ targetScore: Number(event.target.value) })}>
              {TARGET_SCORE_OPTIONS.map((score) => (
                <option key={score} value={score}>{score.toLocaleString()} · {TARGET_LABELS[score]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>酒馆老板风格</span>
            <select value={settings.aiDifficulty} onChange={(event) => onUpdate({ aiDifficulty: event.target.value as GameSettings['aiDifficulty'] })}>
              <option value="conservative">保守</option>
              <option value="normal">均衡</option>
              <option value="aggressive">激进</option>
            </select>
          </label>
        </div>

        <div className="settings-section">
          <div className="section-heading">
            <div><span className="eyebrow">你的骰盅</span><h3>骰子配置</h3></div>
            <span>默认使用公平骰</span>
          </div>
          <div className="loadout-grid">
            {settings.dieLoadout.map((definitionId, index) => {
              const definition = DIE_DEFINITIONS.find((item) => item.id === definitionId) ?? DIE_DEFINITIONS[0]
              return (
                <label className="die-select" key={index}>
                  <span>骰子 {index + 1}</span>
                  <select value={definitionId} onChange={(event) => onLoadoutChange(index, event.target.value)}>
                    {DIE_DEFINITIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <small>{definition.description}</small>
                </label>
              )
            })}
          </div>
        </div>

        <div className="settings-section">
          <div className="section-heading">
            <div><span className="eyebrow">可选规则</span><h3>徽章</h3></div>
            <span>可自由组合</span>
          </div>
          <div className="modifier-grid">
            {MODIFIERS.filter((modifier) => !modifier.adventureOnly).map((modifier) => {
              const active = settings.modifierIds.includes(modifier.id)
              return (
                <button
                  className={`modifier-card ${active ? 'is-active' : ''}`}
                  type="button"
                  aria-pressed={active}
                  key={modifier.id}
                  onClick={() => onToggleModifier(modifier.id)}
                >
                  <span className="modifier-icon" aria-hidden="true">{modifier.symbol}</span>
                  <span><strong>{modifier.name}</strong><small>{modifier.description}</small></span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="settings-section audio-settings">
          <div className="section-heading">
            <div><span className="eyebrow">声音</span><h3>桌面音效</h3></div>
            <span>修改后立即生效</span>
          </div>
          <div className="audio-control-row">
            <button className={`audio-toggle ${audioPreferences.enabled ? 'is-active' : ''}`} type="button" aria-pressed={audioPreferences.enabled} onClick={onToggleAudio}>
              <span aria-hidden="true">{audioPreferences.enabled ? '♪' : '×'}</span>
              {audioPreferences.enabled ? '音效已开启' : '音效已静音'}
            </button>
            <label className="volume-field">
              <span>主音量 <strong>{Math.round(audioPreferences.volume * 100)}%</strong></span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(audioPreferences.volume * 100)}
                disabled={!audioPreferences.enabled}
                onChange={(event) => onAudioVolumeChange(Number(event.target.value) / 100)}
              />
            </label>
          </div>
        </div>

        <button className="primary-action start-action" type="button" onClick={onStart}>
          {isFirstGame ? '开始游戏' : '应用设置并开始新游戏'}
        </button>
      </section>
    </AccessibleDialog>
  )
}
