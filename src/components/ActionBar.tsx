import type { GamePhase, ModifierUsage } from '../game/types'

interface ActionBarProps {
  phase: GamePhase
  isRolling: boolean
  humanTurn: boolean
  selectionValid: boolean
  hasSelection: boolean
  canBank: boolean
  hasGoldenOne: boolean
  hasDoubleDown: boolean
  modifierUsage: ModifierUsage
  onRoll: () => void
  onBank: () => void
  onGoldenOne: () => void
  onDoubleDown: () => void
}

export function ActionBar({
  phase,
  isRolling,
  humanTurn,
  selectionValid,
  hasSelection,
  canBank,
  hasGoldenOne,
  hasDoubleDown,
  modifierUsage,
  onRoll,
  onBank,
  onGoldenOne,
  onDoubleDown,
}: ActionBarProps) {
  const ready = phase === 'ready'
  const selecting = phase === 'selecting'
  const disabled = !humanTurn || isRolling

  return (
    <div className="actions-wrap">
      {(hasGoldenOne || hasDoubleDown) && selecting && (
        <div className="ability-row" aria-label="Modifier abilities">
          {hasGoldenOne && (
            <button
              className="ability-button"
              type="button"
              disabled={disabled || modifierUsage.goldenOneUsed}
              onClick={onGoldenOne}
            >
              <span>☀</span> Golden One {modifierUsage.goldenOneUsed && '· spent'}
            </button>
          )}
          {hasDoubleDown && (
            <button
              className="ability-button"
              type="button"
              disabled={disabled || modifierUsage.doubleDownUsed || !selectionValid}
              onClick={onDoubleDown}
            >
              <span>Ⅱ</span> Double Down {modifierUsage.doubleDownUsed && '· spent'}
            </button>
          )}
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
          {isRolling ? '掷骰中…' : ready ? '掷骰子' : '锁定并继续掷骰'}
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
