import { GameKeyboard } from './GameKeyboard'
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
  abilityDisabledReasons?: Record<string, string | undefined>
  paused?: boolean
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
  abilityDisabledReasons,
  paused = false,
  onRoll,
  onBank,
  onUseModifier,
}: ActionBarProps) {
  const ready = phase === 'ready'
  const selecting = phase === 'selecting'
  const rolling = phase === 'rolling'
  const disabled = paused || !humanTurn || rolling

  const active = abilities.filter((modifier) => modifier.activation)
  const available = (modifier: GameModifier) => !disabled && selecting && canUseModifier(modifier, modifierUsage) && !abilityDisabledReasons?.[modifier.id] && (modifier.activation?.ability !== 'double-down' || selectionValid)
  return (
    <div className="actions-wrap">
      {abilities.length > 0 && (selecting || ready) && (
        <div className="ability-row" aria-label="徽章能力">
          {abilities.map((modifier) => {
            const reason = !modifier.activation ? undefined : !humanTurn ? '等待你的回合。' : paused ? '当前画面、演出或连接尚未就绪。' : !selecting ? '等待投掷完成后使用。' : abilityDisabledReasons?.[modifier.id]
            return (
              <div className="badge-action" key={modifier.id}><button
                className="ability-button"
                type="button"
                disabled={!modifier.activation || !available(modifier)}
                title={reason ?? modifier.description}
                onClick={() => onUseModifier(modifier.id)}
              >
                <span aria-hidden="true">{modifier.symbol}</span>
                {modifier.name} {modifier.activation || modifier.useLimit ? `· 剩余 ${Math.max(0, (modifier.activation ?? modifier.useLimit)!.maxUses - (modifierUsage[(modifier.activation ?? modifier.useLimit)!.scope][modifier.id] ?? 0))}` : '· 被动'}
              </button><details><summary aria-label={`查看${modifier.name}详情`}>ⓘ</summary><p>{modifier.description}</p>{reason && <p>{reason}</p>}</details></div>
            )
          })}
        </div>
      )}
      <GameKeyboard enabled={!disabled && (ready || selecting)} canRoll={ready || (selecting && selectionValid)} canBank={selecting && canBank && selectionValid} onRoll={onRoll} onBank={onBank} abilities={active.map((m) => ({ id: m.id, enabled: available(m) }))} onAbility={onUseModifier} />
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
