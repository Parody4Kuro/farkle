import './App.css'
import { ActionBar } from './components/ActionBar'
import { DiceTable } from './components/DiceTable'
import { GameOverModal } from './components/GameOverModal'
import { RulesModal } from './components/RulesModal'
import { ScoreBoard } from './components/ScoreBoard'
import { SettingsModal } from './components/SettingsModal'
import { TurnPanel } from './components/TurnPanel'
import { getActiveModifiers } from './game/modifiers'
import { useDiceGame } from './hooks/useDiceGame'

function App() {
  const {
    state,
    settings,
    stats,
    audioPreferences,
    gameStarted,
    settingsOpen,
    rulesOpen,
    storageWarning,
    selection,
    selectedScore,
    actions,
  } = useDiceGame()
  const humanTurn = state.currentPlayer === 'human'
  const hasSelection = state.rolledDice.some((die) => die.selected)
  const diceRemaining = state.rolledDice.length > 0
    ? state.rolledDice.filter((die) => !die.selected).length
    : state.diceToRoll
  const overlaySafe = state.phase === 'ready' || state.phase === 'selecting' || state.phase === 'game_over'
  const abilities = getActiveModifiers(state.config.modifierIds)

  const openSettings = () => {
    if (!overlaySafe) return
    actions.setRulesOpen(false)
    actions.setSettingsOpen(true)
  }

  const openRules = () => {
    if (!overlaySafe) return
    actions.setSettingsOpen(false)
    actions.setRulesOpen(true)
  }

  return (
    <main className={`game-shell phase-${state.phase} ${state.isHotDice ? 'hot-dice-active' : ''}`}>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span>✦</span></div>
        <div className="brand-copy">
          <span className="eyebrow">歪皇冠酒馆呈献</span>
          <h1>Tavern Bones</h1>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            type="button"
            aria-label={audioPreferences.enabled ? '静音' : '开启音效'}
            aria-pressed={!audioPreferences.enabled}
            onClick={actions.toggleAudio}
          >
            {audioPreferences.enabled ? '♪' : '×'}
          </button>
          <button className="icon-button" type="button" aria-label="查看规则" disabled={!overlaySafe} onClick={openRules}>?</button>
          <button className="icon-button" type="button" aria-label="打开设置" disabled={!overlaySafe} onClick={openSettings}>⚙</button>
        </div>
      </header>

      {storageWarning && (
        <div className="storage-warning" role="status">
          无法保存本机设置；当前游戏仍可继续。
          <button type="button" onClick={actions.dismissStorageWarning} aria-label="关闭存储提示">×</button>
        </div>
      )}

      <ScoreBoard
        scores={state.scores}
        currentPlayer={state.currentPlayer}
        targetScore={state.config.targetScore}
        difficulty={state.config.aiDifficulty}
      />

      <section className="table-surface">
        <div className="grain" aria-hidden="true" />
        <div className="table-heading">
          <span className="rule" />
          <div>
            <span className="eyebrow">第 {state.turnNumber} 轮</span>
            <h2>{humanTurn ? '你的骰局' : '老板的骰局'}</h2>
          </div>
          <span className="rule" />
        </div>

        <DiceTable
          rolledDice={state.rolledDice}
          lockedDice={state.lockedDice}
          diceToRoll={state.diceToRoll}
          phase={state.phase}
          humanTurn={humanTurn}
          isRolling={state.phase === 'rolling'}
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
          humanTurn={humanTurn}
          selectionValid={selection.valid}
          hasSelection={hasSelection}
          canBank={selection.valid}
          abilities={abilities}
          modifierUsage={state.modifierUsage}
          onRoll={actions.roll}
          onBank={actions.bank}
          onUseModifier={actions.useModifier}
        />
      </section>

      <footer className="footer-bar">
        <span>胜 {stats.wins}</span><span className="footer-rune">✦</span><span>负 {stats.losses}</span>
        <span className="footer-divider" />
        <span>最高回合 {stats.highestTurnScore.toLocaleString()}</span><span className="footer-rune">✦</span><span>最长连投 {stats.longestRollStreak}</span>
      </footer>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          audioPreferences={audioPreferences}
          isFirstGame={!gameStarted}
          onUpdate={actions.updateSettings}
          onLoadoutChange={actions.updateLoadoutDie}
          onToggleModifier={actions.toggleModifier}
          onToggleAudio={actions.toggleAudio}
          onAudioVolumeChange={actions.setAudioVolume}
          onStart={actions.startGame}
          onClose={() => actions.setSettingsOpen(false)}
        />
      )}

      {rulesOpen && <RulesModal onClose={() => actions.setRulesOpen(false)} />}

      {state.phase === 'game_over' && state.winner && !settingsOpen && !rulesOpen && (
        <GameOverModal
          winner={state.winner}
          humanScore={state.scores.human}
          aiScore={state.scores.ai}
          onNewGame={actions.startGame}
          onSettings={openSettings}
        />
      )}
    </main>
  )
}

export default App
