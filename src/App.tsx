import './App.css'
import { ActionBar } from './components/ActionBar'
import { DiceTable } from './components/DiceTable'
import { GameOverModal } from './components/GameOverModal'
import { ScoreBoard } from './components/ScoreBoard'
import { SettingsModal } from './components/SettingsModal'
import { TurnPanel } from './components/TurnPanel'
import { hasActiveAbility } from './game/modifiers'
import { useDiceGame } from './hooks/useDiceGame'

function App() {
  const {
    state,
    settings,
    stats,
    gameStarted,
    settingsOpen,
    isRolling,
    selection,
    selectedScore,
    actions,
  } = useDiceGame()
  const humanTurn = state.currentPlayer === 'human'
  const hasSelection = state.rolledDice.some((die) => die.selected)
  const diceRemaining = state.rolledDice.length > 0
    ? state.rolledDice.filter((die) => !die.selected).length
    : state.diceToRoll

  return (
    <main className={`game-shell phase-${state.phase} ${state.isHotDice ? 'hot-dice-active' : ''}`}>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span>✦</span></div>
        <div className="brand-copy">
          <span className="eyebrow">The Crooked Crown presents</span>
          <h1>Tavern Bones</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open settings" onClick={() => actions.setSettingsOpen(true)}>⚙</button>
      </header>

      <ScoreBoard
        scores={state.scores}
        currentPlayer={state.currentPlayer}
        targetScore={state.targetScore}
        difficulty={settings.aiDifficulty}
      />

      <section className="table-surface">
        <div className="grain" aria-hidden="true" />
        <div className="table-heading">
          <span className="rule" />
          <div>
            <span className="eyebrow">Round {state.turnNumber}</span>
            <h2>{humanTurn ? 'Your cast' : "Innkeeper's cast"}</h2>
          </div>
          <span className="rule" />
        </div>

        <DiceTable
          rolledDice={state.rolledDice}
          lockedDice={state.lockedDice}
          diceToRoll={state.diceToRoll}
          phase={state.phase}
          humanTurn={humanTurn}
          isRolling={isRolling}
          selectionValid={selection.valid}
          onToggleDie={actions.toggleDie}
        />

        <TurnPanel
          turnScore={state.turnScore}
          selectedScore={selectedScore}
          selectedValid={selection.valid}
          hasSelection={hasSelection}
          diceRemaining={diceRemaining}
          currentPlayer={state.currentPlayer}
          message={state.message}
          isHotDice={state.isHotDice}
          doubledSelection={state.doubledSelection}
        />

        <ActionBar
          phase={state.phase}
          isRolling={isRolling}
          humanTurn={humanTurn}
          selectionValid={selection.valid}
          hasSelection={hasSelection}
          canBank={selection.valid}
          hasGoldenOne={hasActiveAbility(settings.modifierIds, 'golden-one')}
          hasDoubleDown={hasActiveAbility(settings.modifierIds, 'double-down')}
          modifierUsage={state.modifierUsage}
          onRoll={actions.roll}
          onBank={actions.bank}
          onGoldenOne={actions.useGoldenOne}
          onDoubleDown={actions.useDoubleDown}
        />
      </section>

      <footer className="footer-bar">
        <span>Wins {stats.wins}</span><span className="footer-rune">✦</span><span>Losses {stats.losses}</span>
        <span className="footer-divider" />
        <span>Best turn {stats.highestTurnScore.toLocaleString()}</span><span className="footer-rune">✦</span><span>Longest run {stats.longestRollStreak}</span>
      </footer>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          isFirstGame={!gameStarted}
          onUpdate={actions.updateSettings}
          onLoadoutChange={actions.updateLoadoutDie}
          onToggleModifier={actions.toggleModifier}
          onStart={actions.startGame}
          onClose={() => actions.setSettingsOpen(false)}
        />
      )}

      {state.phase === 'game_over' && state.winner && !settingsOpen && (
        <GameOverModal
          winner={state.winner}
          humanScore={state.scores.human}
          aiScore={state.scores.ai}
          onNewGame={actions.startGame}
          onSettings={() => actions.setSettingsOpen(true)}
        />
      )}
    </main>
  )
}

export default App
