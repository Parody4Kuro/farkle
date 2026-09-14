import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AdventureRun, Reward } from '../game/adventure'
import { getDieDefinition } from '../game/dice'
import { getModifiers, getModifier } from '../game/modifiers'
import { OPPONENTS, opponentAt } from '../game/opponents'
import { abilityReasons, evaluateSelection } from '../game/selection'
import { useAdventure } from '../hooks/useAdventure'
import { RollPresentation } from '../presentation/rollPresentation'
import type { TableView } from '../scene/camera'
import type { ComfortPreferences } from '../storage/adventureStorage'
import { ActionBar } from './ActionBar'
import { ComfortDialog } from './ComfortDialog'
import { ComicEffects } from './ComicEffects'
import { RulesModal } from './RulesModal'
import { ScoreExplanation } from './ScoreExplanation'
import { TableStage } from './TableStage'
import { CoreChoice } from './CoreChoice'
import { LoadoutPanel } from './LoadoutPanel'
import { PauseDialog } from './PauseDialog'

const styles = { conservative: '稳中求胜', normal: '审时度势', aggressive: '敢押敢追' }

function RewardChoice({ run, onPick, onSkip }: { run: AdventureRun; onPick: (reward: Reward) => void; onSkip: () => void }) {
  const [chosen, setChosen] = useState<Reward | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="night-panel reward-panel" aria-labelledby="reward-title">
    <span className="eyebrow">SOMETHING FOR THE ROAD</span>
    <h2 id="reward-title" ref={heading} tabIndex={-1}>赢来的，选一件带走。</h2>
    <p>选择的物品会加入本夜行囊。已有装备全部保留，下一桌入座前再决定如何搭配。</p>
    <div className="reward-grid">{run.rewards.map((reward) => {
      const item = reward.kind === 'die' ? getDieDefinition(reward.definitionId) : getModifier(reward.definitionId, run.scoringVersion)!
      return <button key={reward.id} className={`loot-card ${chosen?.id === reward.id ? 'chosen' : ''}`} aria-pressed={chosen?.id === reward.id}
        onClick={() => setChosen(reward)}><span className="loot-art" aria-hidden="true">{reward.kind === 'die' ? '⚄' : getModifier(reward.definitionId, run.scoringVersion)!.symbol}</span>
        <small>{reward.kind === 'die' ? '一颗特殊骰' : '一枚徽章'}</small><strong>{item.name}</strong><p>{item.description}</p></button>
    })}</div>
    {chosen && <button className="night-primary" onClick={() => onPick(chosen)}>收入行囊：{chosen.kind === 'die' ? getDieDefinition(chosen.definitionId).name : getModifier(chosen.definitionId, run.scoringVersion)!.name}</button>}
    <button className="night-text" onClick={onSkip}>放弃这次奖励，前往下一桌 →</button>
  </section>
}

export function AdventureGame({ initial, comfort, onComfort, onHome, onFinished, appearanceUnlocked, profileWarning }: {
  initial: AdventureRun; comfort: ComfortPreferences; onComfort: (value: ComfortPreferences) => void
  onHome: (run: AdventureRun) => void; onFinished: (run: AdventureRun) => void; appearanceUnlocked: boolean
  profileWarning?: string
}) {
  const [presentation] = useState(() => new RollPresentation())
  const { run, act, warning, presentationEvent, audioPreferences, setVolume, toggleAudio, playback, paused, canResume, pause, resume } = useAdventure({ initial, presentRoll: presentation.present, playback: presentation.playback, resumeRequired: initial.stage === 'playing', comfort })
  const leave = () => onHome(run)
  const [settings, setSettings] = useState(false)
  const [rules, setRules] = useState(false)
  useLayoutEffect(() => {
    playback.setBlocked('请先关闭面板', run.stage === 'playing' && (settings || rules))
  }, [playback, run.stage, settings, rules])
  const [manualView, setManualView] = useState<{ context: string; view: TableView } | null>(null)
  const [dismissedLine, setDismissedLine] = useState('')
  const stageHeading = useRef<HTMLHeadingElement>(null)
  const game = run.game
  const opponent = opponentAt(run.table)
  const context = `${run.table}:${run.stage}:${run.flow}:${game.currentPlayer}`
  const view = manualView?.context === context ? manualView.view : run.stage === 'playing' ? 'table' : 'opponent'
  const selected = useMemo(() => game.rolledDice.filter((d) => d.selected), [game.rolledDice])
  const choice = useMemo(() => evaluateSelection(game), [game])
  const human = game.currentPlayer === 'human'
  const line = run.stage !== 'playing' ? opponent.intro : game.phase === 'bust' ? opponent.bust
    : run.flow === 'handoff' && !human ? opponent.bank : !human ? opponent.intro : '你的回合。我等着。'
  const finished = run.stage === 'won' || run.stage === 'lost'
  useEffect(() => { if (finished) onFinished(run) }, [finished, run, onFinished])
  useEffect(() => { stageHeading.current?.focus() }, [run.stage, run.table])
  const sceneGame = run.stage === 'seat' ? { ...game, phase: 'ready' as const, currentPlayer: 'human' as const, rolledDice: [], lockedDice: [],
    diceToRoll: 6, config: { ...game.config, dieLoadout: run.loadout, modifierIds: run.modifiers } } : game
  return <main className={`night-shell ${comfort.largeText ? 'large-text' : ''} stage-${run.stage} ${paused ? 'game-paused' : ''}`} data-flow={run.flow} data-paused={paused}>
    <header className="night-header">
      <button className="night-brand" onClick={leave} aria-label="保存并返回酒馆"><span aria-hidden="true">♜</span><span>TAVERN BONES<small>歪皇冠 · 酒馆之夜</small></span></button>
      <nav className="night-progress" aria-label="今晚的路线">{OPPONENTS.map((o, i) => <span key={o.id} className={i === run.table ? 'current' : i < run.table ? 'passed' : ''} aria-current={i === run.table ? 'step' : undefined}><b>{['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][i]}</b>{o.seat}</span>)}</nav>
      <div className="night-tools">{run.stage === 'playing' && <button onClick={pause} aria-label="暂停对局">Ⅱ</button>}<button onClick={toggleAudio} aria-label={audioPreferences.enabled ? '静音' : '开启音效'}>{audioPreferences.enabled ? '♪' : '×'}</button><button onClick={() => setRules(true)} aria-label="查看规则">?</button><button onClick={() => setSettings(true)} aria-label="偏好设置">⚙</button></div>
    </header>
    {warning && <p className="night-warning" role="status">本机存档不可用，当前仍可继续；离开页面后可能无法续玩。</p>}
    {!warning && profileWarning && <p className="night-warning" role="status">{profileWarning}</p>}
    <div className={`night-scene ${run.stage === 'seat' ? 'seating' : ''}`}>
      <TableStage state={sceneGame} presentation={presentation} selectionValid={choice.valid} onToggleDie={(id) => act({ type: 'TOGGLE', id })}
        opponent={opponent} view={view} appearance={comfort.appearance} />
      {run.stage === 'playing' && <>
        <div className="night-scoreband">
          <div className={human ? 'active' : ''}><span>你的账本</span><strong>{game.scores.human.toLocaleString()}</strong></div>
          <div className="night-target"><span>第 {game.turnNumber} 轮 · 目标</span><strong>{game.config.targetScore.toLocaleString()}</strong></div>
          <div className={!human ? 'active' : ''}><span>{opponent.name} · {opponent.title}</span><strong>{game.scores.ai.toLocaleString()}</strong></div>
        </div>
        <div className="view-switch" aria-label="视角"><button aria-pressed={view === 'opponent'} onClick={() => setManualView({ context, view: 'opponent' })}>看向对手</button><button aria-pressed={view === 'table'} onClick={() => setManualView({ context, view: 'table' })}>俯身看骰</button></div>
        <details className="opponent-intel"><summary>{opponent.name}的骰盅 · 公开信息</summary><p>{run.table === 3 ? '老板会依据比分调整冒险程度。' : styles[opponent.difficulty]}</p><ul>{opponent.loadout.map((id, i) => <li key={i}>{getDieDefinition(id).name}</li>)}</ul></details>
        {comfort.dialogue && dismissedLine !== `${context}:${line}` && <div className="opponent-dialogue"><span>{opponent.name}</span>「{line}」<button aria-label="跳过这句对白" onClick={() => setDismissedLine(`${context}:${line}`)}>×</button></div>}
        <ComicEffects event={presentationEvent} playback={playback} />
      </>}
      {run.stage === 'seat' && <>
        <section className="encounter-panel">
          <span className="eyebrow">{run.table === 3 ? 'THE LAST TABLE' : `TABLE 0${run.table + 1} / 04`}</span>
          <h1 ref={stageHeading} tabIndex={-1}>{run.losses === 1 && run.history.at(-1)?.table === run.table && run.history.at(-1)?.winner === 'ai' ? '整理行囊，再战这一桌。' : `${opponent.seat}，有人等你。`}</h1>
          <p className="encounter-quote">「{opponent.intro}」</p>
          <h2>{opponent.name}<small>{opponent.title}</small></h2>
          <p>{run.table === 3 ? '老板观察比分，也观察你的胆量。' : styles[opponent.difficulty]} · 目标 {run.table === 3 ? '4,000' : '2,000'} 分</p>
          <div className="public-dice">{opponent.loadout.map((id, i) => <span key={i} title={getDieDefinition(id).description}>{getDieDefinition(id).name}</span>)}</div>
          <p>入座前可在行囊中调整搭配。重试从双方零分开始，能力次数重置。</p>
          <small className="lives-note">{run.losses === 0 ? '今晚允许一次失利。好好享受这段旅程。' : '已经失利一次。再输一桌，今夜就到这里。'}</small>
        </section>
        <LoadoutPanel key={`${run.table}:${run.history.length}`} run={run} onSit={(loadout, modifiers) => act({ type: 'SIT', loadout, modifiers })} />
        <div className="seat-route">{OPPONENTS.map((o, i) => <div key={o.id} className={i === run.table ? 'current' : ''}><small>{i < run.table ? '已离席' : i === run.table ? '当前桌' : '尚未抵达'}</small><strong>{o.seat}</strong><span>{o.name} · {o.title}</span></div>)}</div>
      </>}
    </div>
    {run.stage === 'playing' && <section className="night-dock" aria-label="本回合操作">
      <div className="night-status" role="status" aria-live="polite"><span className={`turn-dot ${human ? '' : 'ai'}`} />{game.message}<span className="pot-label">本回合待落袋 <b>{game.turnScore.toLocaleString()}</b></span></div>
      <div className="night-decisions"><div className="compact-ledger"><strong>本次 {choice.valid ? choice.score : 0} · 可落袋 {choice.valid ? choice.bankTotal : 0}</strong>{selected.length > 0 && !choice.valid && <p role="status">选择尚未完整计分：请调整 {choice.unusedDice.map((value) => value === 'JOKER' ? '骷髅' : value).join('、')}。</p>}<details><summary>计分明细与风险</summary><ScoreExplanation state={game} /></details></div><ActionBar phase={game.phase} humanTurn={human} selectionValid={choice.valid} hasSelection={selected.length > 0}
        canBank={choice.valid} abilities={getModifiers(game.config.modifierIds)} modifierUsage={game.modifierUsage} abilityDisabledReasons={abilityReasons(game)} paused={paused}
        onRoll={() => act({ type: 'ROLL' })} onBank={() => act({ type: 'BANK' })} onUseModifier={(id) => act({ type: 'ABILITY', id })} /></div>
    </section>}
    {run.stage === 'core' && <div className="night-overlay"><CoreChoice scoringVersion={run.scoringVersion} offers={run.opening.offers} onChoose={(id) => act({ type: 'SELECT_CORE', id })} /></div>}
    {run.stage === 'reward' && <div className="night-overlay"><RewardChoice key={run.table} run={run} onPick={(reward) => act({ type: 'REWARD', id: reward.id, offerId: run.rewardOfferId! })} onSkip={() => act({ type: 'SKIP_REWARD', offerId: run.rewardOfferId! })} /></div>}
    {finished && <div className="night-overlay"><section className="night-panel result-night">
      <span className="eyebrow">{run.stage === 'won' ? 'A NIGHT TO REMEMBER' : 'THE FIRE IS STILL WARM'}</span>
      <h1 ref={stageHeading} tabIndex={-1}>{run.stage === 'won' ? '今夜，皇冠属于你。' : '今夜散场，故事未完。'}</h1>
      <p>{run.stage === 'won' ? '老板为你留了一张熟客的椅子。夜行旅人与月下骰盅已经解锁。' : '累计两次失利，这次旅程结束。商路旧识已经解锁，下次可以试试另一套起手。'}</p>
      <div className="night-recap"><div><span>最大成功落袋</span><strong>{run.peak.toLocaleString()}</strong></div><div><span>最冒险的一次失手</span><strong>{run.largestBust.toLocaleString()}</strong></div><div><span>完成对局</span><strong>{run.history.length}</strong></div></div>
      <ol className="night-history">{run.history.map((h, i) => <li key={i}><span>{opponentAt(h.table).seat} · 第 {h.attempt} 次挑战 · {opponentAt(h.table).name}</span><b>{h.winner === 'human' ? '胜' : '负'}</b><span>{h.humanScore} : {h.aiScore}</span></li>)}</ol>
      <p>本夜骰组：{run.loadout.map((id) => getDieDefinition(id).name).join(' · ')}</p><p>随身徽章：{run.modifiers.map((id) => getModifier(id, run.scoringVersion)?.name).join(' · ') || '无'}</p>
      <button className="night-primary" onClick={leave}>收起行囊，回到酒馆 →</button>
    </section></div>}
    <footer className="night-footer"><span>失利 {run.losses} / 2</span><details className="pack-details"><summary>本夜行囊 · {Object.values(run.inventory.dice).reduce((n, count) => n + count, 0)} 颗骰子</summary><ul>{Object.entries(run.inventory.dice).map(([id, count]) => <li key={id}><b>{getDieDefinition(id).name} × {count} · 已装备 {run.loadout.filter((d) => d === id).length}</b><span>{getDieDefinition(id).description}</span></li>)}{run.inventory.modifiers.map((id) => <li key={id}><b>{getModifier(id, run.scoringVersion)?.name} · {run.modifiers.includes(id) ? '已佩戴' : '未佩戴'}</b><span>{getModifier(id, run.scoringVersion)?.description}</span></li>)}</ul></details><span>徽章 {run.modifiers.length} / 2 {run.modifiers.map((id) => getModifier(id, run.scoringVersion)?.symbol).join(' ')}</span><span className="save-note">{warning ? '本次未能保存' : '进度自动保存在本机'}</span></footer>
    {run.stage === 'playing' && paused && !settings && !rules && <PauseDialog canResume={canResume} onResume={resume} onHome={leave} />}
    {settings && <ComfortDialog value={comfort} onChange={onComfort} onClose={() => setSettings(false)} appearanceUnlocked={appearanceUnlocked} volume={audioPreferences.volume} onVolume={setVolume} />}
    {rules && <RulesModal scoringVersion={run.scoringVersion} onClose={() => setRules(false)} />}
  </main>
}
