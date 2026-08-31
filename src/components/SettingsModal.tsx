import { DIE_DEFINITIONS } from '../game/dice'
import { MODIFIERS } from '../game/modifiers'
import type { GameSettings } from '../game/types'

interface SettingsModalProps {
  settings: GameSettings
  isFirstGame: boolean
  onUpdate: (updates: Partial<GameSettings>) => void
  onLoadoutChange: (index: number, definitionId: string) => void
  onToggleModifier: (modifierId: string) => void
  onStart: () => void
  onClose: () => void
}

export function SettingsModal({
  settings,
  isFirstGame,
  onUpdate,
  onLoadoutChange,
  onToggleModifier,
  onStart,
  onClose,
}: SettingsModalProps) {
  return (
    <div className="modal-backdrop settings-backdrop">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        {!isFirstGame && <button className="modal-close" type="button" aria-label="Close settings" onClick={onClose}>×</button>}
        <span className="eyebrow">House rules</span>
        <h2 id="settings-heading">Prepare the table</h2>
        <p className="settings-intro">Choose your wager, opponent, bones, and optional charms. Settings are kept on this device.</p>

        <div className="setting-grid">
          <label className="field">
            <span>Winning score</span>
            <select value={settings.targetScore} onChange={(event) => onUpdate({ targetScore: Number(event.target.value) })}>
              <option value={2000}>2,000 · Quick game</option>
              <option value={4000}>4,000 · Standard</option>
              <option value={6000}>6,000 · Long game</option>
              <option value={10000}>10,000 · Epic game</option>
            </select>
          </label>
          <label className="field">
            <span>Innkeeper style</span>
            <select value={settings.aiDifficulty} onChange={(event) => onUpdate({ aiDifficulty: event.target.value as GameSettings['aiDifficulty'] })}>
              <option value="conservative">Conservative</option>
              <option value="normal">Normal</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
        </div>

        <div className="settings-section">
          <div className="section-heading">
            <div><span className="eyebrow">Your cup</span><h3>Dice configuration</h3></div>
            <span>Default: fair bones</span>
          </div>
          <div className="loadout-grid">
            {settings.dieLoadout.map((definitionId, index) => (
              <label className="die-select" key={index}>
                <span>Die {index + 1}</span>
                <select value={definitionId} onChange={(event) => onLoadoutChange(index, event.target.value)}>
                  {DIE_DEFINITIONS.map((definition) => (
                    <option key={definition.id} value={definition.id}>{definition.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="definition-note">
            {DIE_DEFINITIONS.find((definition) => definition.id === settings.dieLoadout[0])?.description}
          </p>
        </div>

        <div className="settings-section">
          <div className="section-heading">
            <div><span className="eyebrow">Optional</span><h3>Charms & badges</h3></div>
            <span>Mix freely</span>
          </div>
          <div className="modifier-grid">
            {MODIFIERS.map((modifier) => {
              const active = settings.modifierIds.includes(modifier.id)
              return (
                <button
                  className={`modifier-card ${active ? 'is-active' : ''}`}
                  type="button"
                  aria-pressed={active}
                  key={modifier.id}
                  onClick={() => onToggleModifier(modifier.id)}
                >
                  <span className="modifier-icon" aria-hidden="true">{modifier.id === 'lucky-charm' ? '☘' : modifier.id === 'loaded-hand' ? '✋' : modifier.id === 'golden-one' ? '☀' : 'Ⅱ'}</span>
                  <span><strong>{modifier.name}</strong><small>{modifier.description}</small></span>
                </button>
              )
            })}
          </div>
        </div>

        <button className="primary-action start-action" type="button" onClick={onStart}>
          {isFirstGame ? 'Start Game' : 'Start New Game'}
        </button>
      </section>
    </div>
  )
}
