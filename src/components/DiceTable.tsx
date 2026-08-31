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
      <div className="dice-row" aria-live="polite" aria-label="Dice on the table">
        {showPlaceholders && placeholders.map((index) => (
          <Dice
            key={`placeholder-${index}`}
            value={((index * 2 + 1) % 6 + 1) as 1 | 2 | 3 | 4 | 5 | 6}
            rolling={isRolling}
            disabled
          />
        ))}
        {rolledDice.map((die) => (
          <Dice
            key={die.id}
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
          ? selectionValid ? 'A legal scoring selection' : 'Selection contains non-scoring dice'
          : phase === 'selecting' ? 'Select the dice you wish to keep' : ' '}
      </div>
      <div className="locked-tray">
        <span className="tray-label">Scoring tray</span>
        <div className="locked-row">
          {lockedDice.length === 0 ? (
            <span className="empty-tray">Kept dice will rest here until the turn ends</span>
          ) : lockedDice.map((die) => (
            <Dice key={`locked-${die.id}`} value={die.value} locked compact disabled />
          ))}
        </div>
      </div>
    </div>
  )
}
