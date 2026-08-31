import { canUseModifier } from '../game/modifiers'
import type { GameModifier, GamePhase, ModifierUsage } from '../game/types'

interface ActionBarProps {
  phase: GamePhase
  humanTurn: boolean
  selectionValid: boolean
  hasSelection: boolean
  canBank: boolean
  abilities: GameModifier[]
  modifierUsage: ModifierUsage
  onRoll: () => void
  onBank: () => void
  onUseModifier: (modifierId: string) => void
}

export function ActionBar({
  phase,
  humanTurn,
  selectionValid,
  hasSelection,
  canBank,
  abilities,
  modifierUsage,
  onRoll,
  onBank,
  onUseModifier,
}: ActionBarProps) {
  const ready = phase === 'ready'
  const selecting = phase === 'selecting'
  const rolling = phase === 'rolling'
  const disabled = !humanTurn || rolling

  return (
    <div className="actions-wrap">
      {abilities.length > 0 && selecting && (
        <div className="ability-row" aria-label="徽章能力">
          {abilities.map((modifier) => {
            const spent = !canUseModifier(modifier, modifierUsage)
            const needsValidSelection = modifier.activation?.ability === 'double-down'
            return (
              <button
                className="ability-button"
                type="button"
                disabled={disabled || spent || (needsValidSelection && !selectionValid)}
                key={modifier.id}
                onClick={() => onUseModifier(modifier.id)}
              >
                <span aria-hidden="true">{modifier.symbol}</span>
                {modifier.name} {spent && '· 已使用'}
              </button>
            )
          })}
        </div>
      )}
      <div className="action-bar">
        <button
          className="primary-action"
          type="button"
          disabled={disabled || (!ready && (!selecting || !selectionValid))}
          onClick={onRoll}
        >
          <span aria-hidden="true">◆</span>
          {rolling ? '掷骰中…' : ready ? '掷骰子' : '锁定并继续掷骰'}
        </button>
        {!ready && (
          <button
            className="secondary-action"
            type="button"
            disabled={disabled || !selecting || !canBank || (hasSelection && !selectionValid)}
            onClick={onBank}
          >
            保存分数
          </button>
        )}
      </div>
    </div>
  )
}
