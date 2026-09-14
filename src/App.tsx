import { useCallback, useEffect, useState } from 'react'
import './App.css'
import './comic.css'
import './night.css'
import './friends.css'
import { FriendGame } from './components/FriendGame'
import { TableStage } from './components/TableStage'
import { ComicEffects } from './components/ComicEffects'
import { RollPresentation } from './presentation/rollPresentation'
import { ActionBar } from './components/ActionBar'
import { GameOverModal } from './components/GameOverModal'
import { RulesModal } from './components/RulesModal'
import { ScoreBoard } from './components/ScoreBoard'
import { SettingsModal } from './components/SettingsModal'
import { TurnPanel } from './components/TurnPanel'
import { getModifiers } from './game/modifiers'
import { useDiceGame } from './hooks/useDiceGame'
import { createAdventure, type AdventureRun } from './game/adventure'
import { bustProbability, nextHumanLoadout } from './game/risk'
import { readAdventure, saveAdventure, COMFORT_KEY, PROFILE_KEY, loadAdventure, loadComfort, loadProfile, recordAdventure, type ComfortPreferences } from './storage/adventureStorage'
import { getBrowserStorage, saveStored } from './storage/gameStorage'
import { AdventureGame } from './components/AdventureGame'
import { TavernLobby } from './components/TavernLobby'
import { ScoreExplanation } from './components/ScoreExplanation'
import { abilityReasons } from './game/selection'
import { PauseDialog } from './components/PauseDialog'

function ClassicGame({ onHome }: { onHome: () => void }) {
  const [presentation] = useState(() => new RollPresentation())
  const {
    state,
    playback, paused, canResume, pause, resume,
    presentationEvent,
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
  } = useDiceGame({ presentRoll: presentation.present, playback: presentation.playback })
  const humanTurn = state.currentPlayer === 'human'
  const hasSelection = state.rolledDice.some((die) => die.selected)
  const diceRemaining = state.rolledDice.length > 0
    ? state.rolledDice.filter((die) => !die.selected).length
    : state.diceToRoll
  const overlaySafe = state.phase === 'ready' || state.phase === 'selecting' || state.phase === 'game_over'
  const abilities = getModifiers(state.config.modifierIds)

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
    <main className={`game-shell classic-game phase-${state.phase} ${state.isHotDice ? 'hot-dice-active' : ''} ${paused ? 'game-paused' : ''}`} data-paused={paused}>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span>✦</span></div>
        <div className="brand-copy">
          <span className="eyebrow">THE CROOKED CROWN · 歪皇冠酒馆</span>
          <h1>Tavern Bones</h1>
        </div>
        <div className="header-actions">
          {gameStarted && state.phase !== 'game_over' && <button className="icon-button" aria-label="暂停对局" onClick={pause}>Ⅱ</button>}
          <button className="icon-button" type="button" aria-label="返回酒馆" onClick={onHome}>⌂</button>
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

        <TableStage state={state} presentation={presentation} selectionValid={selection.valid} onToggleDie={actions.toggleDie} />
        <ComicEffects event={presentationEvent} playback={playback} />
        <div className="table-caption">
          <span className="caption-ornament" aria-hidden="true">✦</span>
          <span className={hasSelection && !selection.valid ? 'caption-invalid' : ''}>
            {state.phase === 'ready' ? '骰盅已备好。今晚，好运站在哪边？'
              : state.phase === 'rolling' ? '骰子落定前，一切皆有可能。'
              : state.currentPlayer === 'ai' ? '酒馆老板正在出手…'
              : hasSelection ? selection.valid ? '好选择！继续冒险，或将分数落袋。' : '选择中含有不能计分的骰子，请调整。'
              : '点击桌面上的骰子，留下你的计分组合。'}
          </span>
          <span className="caption-ornament" aria-hidden="true">✦</span>
        </div>
        <div className="turn-dock">

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
            riskPercent={humanTurn ? bustProbability(nextHumanLoadout(state)) : undefined}
          />

          <ActionBar
            phase={state.phase}
            humanTurn={humanTurn}
            selectionValid={selection.valid}
            hasSelection={hasSelection}
            canBank={selection.valid}
            abilities={abilities}
            modifierUsage={state.modifierUsage}
            abilityDisabledReasons={abilityReasons(state)}
            paused={paused}
            onRoll={actions.roll}
            onBank={actions.bank}
            onUseModifier={actions.useModifier}
          />
        </div>
      </section>

      <footer className="footer-bar">
        <span className="footer-motto">一把骰子 · 一桌故事</span><span>胜 {stats.wins}</span><span className="footer-rune">✦</span><span>负 {stats.losses}</span>
        <span className="footer-divider" />
        <span>最高回合 {stats.highestTurnScore.toLocaleString()}</span><span className="footer-rune">✦</span><span>最长连投 {stats.longestRollStreak}</span>
      </footer>
      <details className="classic-ledger"><summary>查看计分明细与下一投风险</summary><ScoreExplanation state={state} /></details>

      {gameStarted && state.phase !== 'game_over' && paused && !settingsOpen && !rulesOpen && <PauseDialog canResume={canResume} onResume={resume} onHome={onHome} />}
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

function App() {
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('[role="dialog"],dialog[open]')) return
      if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable="true"]')) return
      if (event.key === 'Escape') {
        const detail = [...document.querySelectorAll<HTMLDetailsElement>('main details[open]')].at(-1)
        if (detail) { event.preventDefault(); detail.open = false; detail.querySelector<HTMLElement>('summary')?.focus(); return }
      }
      const label = event.key.toLowerCase() === 't' ? '查看规则' : event.key === 'Escape' ? '暂停对局' : ''
      const button = label ? document.querySelector<HTMLButtonElement>(`main button[aria-label="${label}"]:not(:disabled)`) : null
      if (button) { event.preventDefault(); button.click() }
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [])
  const [mode, setMode] = useState<'lobby' | 'classic' | 'adventure' | 'friends'>('lobby')
  const [restored] = useState(readAdventure)
  const [saved, setSaved] = useState(restored.run)
  const [profile, setProfile] = useState(() => saved ? recordAdventure(loadProfile(), saved) : loadProfile())
  const [comfort, setComfort] = useState(loadComfort)
  const [warning, setWarning] = useState(restored.warning)
  const updateComfort = (next: ComfortPreferences) => {
    setComfort(next)
    if (!saveStored(getBrowserStorage(), COMFORT_KEY, next)) setWarning('无法保存偏好；当前设置仍然生效。')
  }
  const finish = useCallback((run: AdventureRun) => {
    setProfile((current) => recordAdventure(current, run))
  }, [])
  useEffect(() => {
    if (saveStored(getBrowserStorage(), PROFILE_KEY, profile)) return
    const timer = window.setTimeout(() => setWarning('本次收藏未能保存，请保持页面开启。'), 0)
    return () => window.clearTimeout(timer)
  }, [profile])
  const home = (inMemory?: AdventureRun) => {
    const run = inMemory ?? loadAdventure()
    setSaved(run)
    if (run) setProfile((current) => recordAdventure(current, run))
    setMode('lobby')
  }
  if (mode === 'friends') return <FriendGame onHome={() => home()} />
  if (mode === 'classic') return <ClassicGame onHome={() => home()} />
  if (mode === 'adventure' && saved) return <AdventureGame key={saved.id} initial={saved} comfort={comfort} onComfort={updateComfort} onHome={home} onFinished={finish} appearanceUnlocked={profile.wins > 0} profileWarning={warning} />
  return <TavernLobby saved={saved} profile={profile} comfort={comfort} warning={warning} onComfort={updateComfort} onClassic={() => setMode('classic')} onFriends={() => setMode('friends')}
    onContinue={() => setMode('adventure')} onStart={(origin) => {
      const run = createAdventure(crypto.getRandomValues(new Uint32Array(1))[0], crypto.randomUUID(), origin)
      if (!saveAdventure(run)) setWarning('无法保存这次冒险；当前仍可继续。')
      else setWarning('')
      setSaved(run); setMode('adventure')
    }} />
}

export default App
