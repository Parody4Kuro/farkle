import { getDieDefinition } from '../game/dice'
import type { DieInstance, GamePhase } from '../game/types'
import { Dice } from './Dice'

interface DiceTableProps {
  rolledDice: DieInstance[]
  lockedDice: DieInstance[]
  diceToRoll: number
  phase: GamePhase
  humanTurn: boolean
  isRolling: boolean
  selectionValid: boolean
  onToggleDie: (id: string) => void
}

export function DiceTable({
  rolledDice,
  lockedDice,
  diceToRoll,
  phase,
  humanTurn,
  isRolling,
  selectionValid,
  onToggleDie,
}: DiceTableProps) {
  const placeholders = Array.from({ length: diceToRoll }, (_, index) => index)
  const showPlaceholders = rolledDice.length === 0 && (isRolling || phase === 'ready')

  return (
    <div className="dice-stage">
      <div className="dice-row" role="group" aria-label="桌面上的骰子">
        {showPlaceholders && placeholders.map((index) => (
          <Dice
            key={`placeholder-${index}`}
            value={((index * 2 + 1) % 6 + 1) as 1 | 2 | 3 | 4 | 5 | 6}
            rolling={isRolling}
            disabled
          />
        ))}
        {rolledDice.map((die, index) => (
          <Dice
            key={die.id}
            dieId={die.id} number={index + 1}
            value={die.value}
            name={getDieDefinition(die.definitionId).name}
            selected={die.selected}
            disabled={!humanTurn || phase !== 'selecting'}
            onClick={() => onToggleDie(die.id)}
          />
        ))}
      </div>
      <div className={`selection-caption ${rolledDice.some((die) => die.selected) && !selectionValid ? 'is-invalid' : ''}`}>
        {rolledDice.some((die) => die.selected)
          ? selectionValid ? '当前选择可以计分' : '当前选择含有不能计分的骰子'
          : phase === 'selecting' ? '选择想要保留的计分骰' : ' '}
      </div>
      <div className="locked-tray">
        <span className="tray-label">计分托盘</span>
        <div className="locked-row">
          {lockedDice.length === 0 ? (
            <span className="empty-tray">锁定的计分骰会留在这里，直到本回合结束</span>
          ) : lockedDice.slice(-7).map((die) => (
            <Dice key={`locked-${die.id}`} value={die.value} locked compact disabled />
          ))}
        </div>
        {lockedDice.length > 7 && <details className="fallback-history"><summary>查看全部 {lockedDice.length} 颗锁定骰</summary><p>{lockedDice.map((die) => die.value).join(" · ")}</p></details>}
      </div>
    </div>
  )
}
