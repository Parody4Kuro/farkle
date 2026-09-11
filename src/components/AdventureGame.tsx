import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdventureRun, Reward } from '../game/adventure'
import { getDieDefinition } from '../game/dice'
import { getActiveModifiers, getModifier } from '../game/modifiers'
import { OPPONENTS, opponentAt } from '../game/opponents'
import { validateSelectedDice } from '../game/scoring'
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

const styles = { conservative: '稳中求胜', normal: '审时度势', aggressive: '敢押敢追' }

function RewardChoice({ run, onPick, onSkip }: { run: AdventureRun; onPick: (reward: Reward, slot?: number) => void; onSkip: () => void }) {
  const [chosen, setChosen] = useState<Reward | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="night-panel reward-panel" aria-labelledby="reward-title">
    <span className="eyebrow">SOMETHING FOR THE ROAD</span>
    <h2 id="reward-title" ref={heading} tabIndex={-1}>赢来的，选一件带走。</h2>
    <p>骰盅只有六个位置，徽章只能佩戴两枚。下一桌的打法，由这次选择开始。</p>
    <div className="reward-grid">{run.rewards.map((reward) => {
      const item = reward.kind === 'die' ? getDieDefinition(reward.definitionId) : getModifier(reward.definitionId)!
      return <button key={reward.id} className={`loot-card ${chosen?.id === reward.id ? 'chosen' : ''}`} aria-pressed={chosen?.id === reward.id}
        onClick={() => setChosen(reward)}><span className="loot-art" aria-hidden="true">{reward.kind === 'die' ? '⚄' : getModifier(reward.definitionId)!.symbol}</span>
        <small>{reward.kind === 'die' ? '一颗特殊骰' : '一枚徽章'}</small><strong>{item.name}</strong><p>{item.description}</p></button>
    })}</div>
    {chosen && <div className="replacement-picker">
      <h3>{chosen.kind === 'die' ? '替换哪颗骰子？' : run.modifiers.length < 2 ? '还有空余的徽章位置。' : '替换哪枚徽章？'}</h3>
      {chosen.kind === 'die' ? <div className="slot-grid">{run.loadout.map((id, i) => <button key={i} onClick={() => onPick(chosen, i)}><small>位置 {i + 1}</small>{getDieDefinition(id).name}</button>)}</div>
        : run.modifiers.length < 2 ? <button className="night-primary" onClick={() => onPick(chosen)}>装备{getModifier(chosen.definitionId)!.name}</button>
          : <div className="slot-grid">{run.modifiers.map((id, i) => <button key={id} onClick={() => onPick(chosen, i)}>替换{getModifier(id)!.name}</button>)}</div>}
    </div>}
    <button className="night-text" onClick={onSkip}>保持行囊，前往下一桌 →</button>
  </section>
}

export function AdventureGame({ initial, comfort, onComfort, onHome, onFinished, appearanceUnlocked, profileWarning }: {
  initial: AdventureRun; comfort: ComfortPreferences; onComfort: (value: ComfortPreferences) => void
  onHome: () => void; onFinished: (run: AdventureRun) => void; appearanceUnlocked: boolean
  profileWarning?: string
}) {
  const [presentation] = useState(() => new RollPresentation())
  const { run, act, warning, presentationEvent, audioPreferences, setVolume, toggleAudio } = useAdventure({ initial, presentRoll: presentation.present, comfort })
  const [settings, setSettings] = useState(false)
  const [rules, setRules] = useState(false)
  const [manualView, setManualView] = useState<{ context: string; view: TableView } | null>(null)
  const [dismissedLine, setDismissedLine] = useState('')
  const stageHeading = useRef<HTMLHeadingElement>(null)
  const game = run.game
  const opponent = opponentAt(run.table)
  const context = `${run.table}:${run.stage}:${run.flow}:${game.currentPlayer}`
  const view = manualView?.context === context ? manualView.view : run.stage === 'playing' ? 'table' : 'opponent'
  const selected = useMemo(() => game.rolledDice.filter((d) => d.selected), [game.rolledDice])
  const choice = useMemo(() => validateSelectedDice(selected.map((d) => d.value)), [selected])
  const human = game.currentPlayer === 'human'
  const line = run.stage !== 'playing' ? opponent.intro : game.phase === 'bust' ? opponent.bust
    : run.flow === 'handoff' && !human ? opponent.bank : !human ? opponent.intro : '你的回合。我等着。'
  const finished = run.stage === 'won' || run.stage === 'lost'
  useEffect(() => { if (finished) onFinished(run) }, [finished, run, onFinished])
  useEffect(() => { stageHeading.current?.focus() }, [run.stage, run.table])
  const sceneGame = run.stage === 'seat' ? { ...game, phase: 'ready' as const, currentPlayer: 'human' as const, rolledDice: [], lockedDice: [],
    diceToRoll: 6, config: { ...game.config, dieLoadout: run.loadout, modifierIds: run.modifiers } } : game
  return <main className={`night-shell ${comfort.largeText ? 'large-text' : ''} stage-${run.stage}`} data-flow={run.flow}>
    <header className="night-header">
      <button className="night-brand" onClick={onHome} aria-label="保存并返回酒馆"><span aria-hidden="true">♜</span><span>TAVERN BONES<small>歪皇冠 · 酒馆之夜</small></span></button>
      <nav className="night-progress" aria-label="今晚的路线">{OPPONENTS.map((o, i) => <span key={o.id} className={i === run.table ? 'current' : i < run.table ? 'passed' : ''} aria-current={i === run.table ? 'step' : undefined}><b>{['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][i]}</b>{o.seat}</span>)}</nav>
      <div className="night-tools"><button onClick={toggleAudio} aria-label={audioPreferences.enabled ? '静音' : '开启音效'}>{audioPreferences.enabled ? '♪' : '×'}</button><button onClick={() => setRules(true)} aria-label="查看规则">?</button><button onClick={() => setSettings(true)} aria-label="偏好设置">⚙</button></div>
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
        <ComicEffects event={presentationEvent} />
      </>}
      {run.stage === 'seat' && <>
        <section className="encounter-panel">
          <span className="eyebrow">{run.table === 3 ? 'THE LAST TABLE' : `TABLE 0${run.table + 1} / 04`}</span>
          <h1 ref={stageHeading} tabIndex={-1}>{run.table === 3 && run.losses === 1 && run.history.at(-1)?.table === 3 ? '最后一次机会。' : `${opponent.seat}，有人等你。`}</h1>
          <p className="encounter-quote">「{opponent.intro}」</p>
          <h2>{opponent.name}<small>{opponent.title}</small></h2>
          <p>{run.table === 3 ? '老板观察比分，也观察你的胆量。' : styles[opponent.difficulty]} · 目标 {run.table === 3 ? '4,000' : '2,000'} 分</p>
          <div className="public-dice">{opponent.loadout.map((id, i) => <span key={i} title={getDieDefinition(id).description}>{getDieDefinition(id).name}</span>)}</div>
          <button className="night-primary" onClick={() => act({ type: 'SIT' })}>入座，开始这一桌 <span aria-hidden="true">→</span></button>
          <small className="lives-note">{run.losses === 0 ? '今晚允许一次失利。好好享受这段旅程。' : '已经失利一次。再输一桌，今夜就到这里。'}</small>
        </section>
        <div className="seat-route">{OPPONENTS.map((o, i) => <button key={o.id} disabled={i !== run.table} onClick={() => act({ type: 'SIT' })} className={i === run.table ? 'current' : ''}><small>{i < run.table ? '已离席' : i === run.table ? '下一桌 · 点击入座' : '尚未抵达'}</small><strong>{o.seat}</strong><span>{o.name} · {o.title}</span></button>)}</div>
      </>}
    </div>
    {run.stage === 'playing' && <section className="night-dock" aria-label="本回合操作">
      <div className="night-status" role="status" aria-live="polite"><span className={`turn-dot ${human ? '' : 'ai'}`} />{game.message}<span className="pot-label">本回合待落袋 <b>{game.turnScore.toLocaleString()}</b></span></div>
      <div className="night-decisions"><ScoreExplanation state={game} /><ActionBar phase={game.phase} humanTurn={human} selectionValid={choice.valid} hasSelection={selected.length > 0}
        canBank={choice.valid} abilities={getActiveModifiers(game.config.modifierIds)} modifierUsage={game.modifierUsage}
        onRoll={() => act({ type: 'ROLL' })} onBank={() => act({ type: 'BANK' })} onUseModifier={(id) => act({ type: 'ABILITY', id })} /></div>
    </section>}
    {run.stage === 'reward' && <div className="night-overlay"><RewardChoice key={run.table} run={run} onPick={(reward, slot) => act({ type: 'REWARD', id: reward.id, slot })} onSkip={() => act({ type: 'SKIP_REWARD' })} /></div>}
    {finished && <div className="night-overlay"><section className="night-panel result-night">
      <span className="eyebrow">{run.stage === 'won' ? 'A NIGHT TO REMEMBER' : 'THE FIRE IS STILL WARM'}</span>
      <h1 ref={stageHeading} tabIndex={-1}>{run.stage === 'won' ? '今夜，皇冠属于你。' : '今夜散场，故事未完。'}</h1>
      <p>{run.stage === 'won' ? '老板为你留了一张熟客的椅子。夜行旅人与月下骰盅已经解锁。' : '输掉两桌，这次旅程结束。商路旧识已经解锁，下次可以试试另一套起手。'}</p>
      <div className="night-recap"><div><span>最大成功落袋</span><strong>{run.peak.toLocaleString()}</strong></div><div><span>最冒险的一次失手</span><strong>{run.largestBust.toLocaleString()}</strong></div><div><span>完成对局</span><strong>{run.history.length}</strong></div></div>
      <ol className="night-history">{run.history.map((h, i) => <li key={i}><span>{opponentAt(h.table).seat} · {opponentAt(h.table).name}</span><b>{h.winner === 'human' ? '胜' : '负'}</b><span>{h.humanScore} : {h.aiScore}</span></li>)}</ol>
      <p>本夜骰组：{run.loadout.map((id) => getDieDefinition(id).name).join(' · ')}</p><p>随身徽章：{run.modifiers.map((id) => getModifier(id)?.name).join(' · ') || '无'}</p>
      <button className="night-primary" onClick={onHome}>收起行囊，回到酒馆 →</button>
    </section></div>}
    <footer className="night-footer"><span>失利 {run.losses} / 2</span><details className="pack-details"><summary>行囊 · {run.loadout.filter((id) => id !== 'standard').length} 颗特殊骰</summary><ul>{run.loadout.map((id, i) => <li key={i}><b>{i + 1} · {getDieDefinition(id).name}</b><span>{getDieDefinition(id).description}</span></li>)}{run.modifiers.map((id) => <li key={id}><b>{getModifier(id)?.name}</b><span>{getModifier(id)?.description}</span></li>)}</ul></details><span>徽章 {run.modifiers.length} / 2 {run.modifiers.map((id) => getModifier(id)?.symbol).join(' ')}</span><span className="save-note">{warning ? '本次未能保存' : '进度自动保存在本机'}</span></footer>
    {settings && <ComfortDialog value={comfort} onChange={onComfort} onClose={() => setSettings(false)} appearanceUnlocked={appearanceUnlocked} volume={audioPreferences.volume} onVolume={setVolume} />}
    {rules && <RulesModal onClose={() => setRules(false)} />}
  </main>
}
