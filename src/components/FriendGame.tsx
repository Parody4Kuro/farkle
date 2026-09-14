import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DUEL_INVENTORY, duelView, otherSeat, type DuelRoll, type MatchCommand } from '../game/duel'
import { getDieDefinition } from '../game/dice'
import { abilityReasons, evaluateSelection } from '../game/selection'
import { getModifier, getModifiers } from '../game/modifiers'
import { TARGET_SCORE_OPTIONS } from '../game/rules'
import { FriendSession } from '../multiplayer/FriendSession'
import { RollPresentation } from '../presentation/rollPresentation'
import { AUDIO_KEY, getBrowserStorage, loadAudioPreferences, saveStored } from '../storage/gameStorage'
import { WebGameAudio } from '../audio/gameAudio'
import { useGamePlayback } from '../hooks/useGamePlayback'
import { TableStage } from './TableStage'
import { LoadoutEditor } from './LoadoutEditor'
import { ActionBar } from './ActionBar'
import { RulesModal } from './RulesModal'
import { ScoreExplanation } from './ScoreExplanation'
import { AccessibleDialog } from './AccessibleDialog'

export function FriendGame({ onHome }: { onHome: () => void }) {
  const [session] = useState(() => new FriendSession())
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const { state, role, status, pending } = snapshot
  const [presentation] = useState(() => new RollPresentation())
  const [audioPreferences, setAudioPreferences] = useState(loadAudioPreferences)
  const [audio] = useState(() => new WebGameAudio(audioPreferences))
  const { paused, pause, resume, canResume } = useGamePlayback({ active: state.stage !== 'lobby', audio, playback: presentation.playback })
  const [input, setInput] = useState(''), [output, setOutput] = useState(''), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [copied, setCopied] = useState(false), [rules, setRules] = useState(false), [leaving, setLeaving] = useState(false)
  const [selected, setSelected] = useState<{ revision: number; ids: string[] }>({ revision: -1, ids: [] })
  const [animation, setAnimation] = useState<DuelRoll | null>(null)
  const lastSerial = useRef(0)
  const viewer = role ?? 'host'
  const selectedIds = state.game.doubledSelection ? state.game.rolledDice.filter((d) => d.selected).map((d) => d.id) : selected.revision === state.revision ? selected.ids : []
  const shownIds = state.active === viewer ? selectedIds : snapshot.preview?.ids ?? []
  const game = duelView(state, viewer, shownIds)
  const choice = evaluateSelection({ ...state.game, rolledDice: state.game.rolledDice.map((d) => ({ ...d, selected: shownIds.includes(d.id) })) })
  const blocked = paused || rules || leaving || Boolean(animation) || status !== 'connected' || pending
  useEffect(() => { session.activate(); return session.dispose }, [session])
  useEffect(() => () => { void audio.dispose() }, [audio])
  useEffect(() => { presentation.playback.setBlocked('请先关闭面板', rules || leaving) }, [rules, leaving, presentation])
  useEffect(() => {
    const controller = new AbortController()
    if (paused || status !== 'connected') { lastSerial.current = state.rollSerial; return () => controller.abort() }
    const rolls = state.rolls.filter((roll) => roll.serial > lastSerial.current)
    lastSerial.current = state.rollSerial
    void (async () => {
      for (const roll of rolls) {
        if (controller.signal.aborted) return
        setAnimation(roll); audio.play('roll')
        await presentation.present({ id: roll.serial, dice: roll.dice, player: roll.actor === viewer ? 'human' : 'ai', onImpact: (strength) => audio.playImpact?.(strength) }, controller.signal)
        if (controller.signal.aborted) return
        if (roll.bust) audio.play('bust')
      }
      if (!controller.signal.aborted) setAnimation(null)
    })()
    return () => controller.abort()
  }, [state.rollSerial, state.rolls, paused, status, presentation, audio, viewer])
  const operation = async (run: () => Promise<string | void>) => {
    setBusy(true); setError(''); setCopied(false)
    try { void audio.unlock(); const result = await run(); if (result) setOutput(result) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const command = (cmd: MatchCommand) => { void audio.unlock(); session.command(cmd) }
  const toggle = (id: string) => {
    if (blocked || state.active !== viewer || state.game.phase !== 'selecting' || state.game.doubledSelection) return
    const ids = selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]
    setSelected({ revision: state.revision, ids }); session.preview(ids); void audio.unlock().then(() => audio.play('select'))
  }
  const visual = animation && !paused && status === 'connected' ? { ...game, rolledDice: animation.dice, currentPlayer: animation.actor === viewer ? 'human' as const : 'ai' as const, phase: 'rolling' as const, diceToRoll: animation.dice.length } : game
  return <main className="friend-shell">
    <header className="friend-header"><h1>Tavern Bones · 好友对战</h1><div><button aria-label={audioPreferences.enabled ? '静音' : '开启音效'} onClick={() => { const next = { ...audioPreferences, enabled: !audioPreferences.enabled }; setAudioPreferences(next); audio.setEnabled(next.enabled); saveStored(getBrowserStorage(), AUDIO_KEY, next); if (next.enabled) void audio.unlock() }}>{audioPreferences.enabled ? '♪' : '静音'}</button><button aria-label="查看规则" onClick={() => setRules(true)}>规则 T</button>{state.stage !== 'lobby' && <button aria-label="暂停对局" onClick={pause}>暂停画面</button>}<button onClick={() => role ? setLeaving(true) : onHome()}>返回酒馆</button></div></header>
    {(error || snapshot.error) && <p role="alert" className="friend-error">{error || snapshot.error}</p>}
    <p className="friend-status" role="status">{({ idle: '邀请一位朋友，坐到同一张桌前。', connecting: '正在建立连接…', waiting: '连接文本已生成，等待交换完成。', connected: '已直连 · 双方窗口需保持开启', disconnected: '已断线 · 当前局面保留', failed: '连接失败 · 可以重新交换连接文本', ended: '会话已结束，请返回酒馆创建新对局。' })[status]}</p>
    {status !== 'connected' && status !== 'ended' && <section className="friend-panel" aria-label="邀请朋友">
      <h2>{role ? '重新连接朋友' : '邀请朋友入座'}</h2><p>房主发邀请，朋友回回应，房主粘贴回应后连接。通过你常用的聊天工具交换这两段文本。无需账号或房间服务器；部分网络无法直连。</p>
      <div className="friend-actions">{role !== 'guest' && <button disabled={busy} onClick={() => void operation(() => session.createInvite())}>{role ? '生成新的重连邀请' : '创建对局并生成邀请'}</button>}</div>
      <label htmlFor="friend-input">{role === 'host' ? '粘贴朋友的回应' : '粘贴房主的邀请'}</label><textarea id="friend-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={131072} spellCheck={false} />
      <button disabled={busy || !input.trim()} onClick={() => void operation(() => role === 'host' ? session.acceptAnswer(input) : session.acceptInvite(input))}>{role === 'host' ? '使用回应，连接朋友' : '使用邀请，生成回应'}</button>
      {output && <><label htmlFor="friend-output">{role === 'host' ? '把邀请发给朋友' : '把回应发回房主'}</label><textarea id="friend-output" value={output} readOnly spellCheck={false} /><button onClick={() => { void navigator.clipboard?.writeText(output).then(() => setCopied(true)).catch(() => setError('请选中连接文本，使用系统复制操作。')) }}>{copied ? '已复制' : '复制连接文本'}</button></>}
      {busy && <p role="status">正在收集连接信息，请稍候…</p>}
      {state.stage !== 'lobby' && <p>当前比分：房主 {state.players.host.score} : 朋友 {state.players.guest.score}。重连成功后恢复，不会重新掷骰。</p>}
    </section>}
    {status === 'connected' && state.stage === 'lobby' && <section className="friend-panel friend-room" aria-label="好友对局整备">
      <h2>准备这张桌 · 你是{viewer === 'host' ? '房主' : '朋友'}</h2>
      <div className="room-options"><label>玩法<select aria-label="好友玩法" disabled={viewer !== 'host' || pending} value={state.mode} onChange={(e) => command({ type: 'CONFIG', mode: e.target.value as 'fair' | 'free', target: state.target })}><option value="fair">公平局 · 普通骰，无徽章</option><option value="free">自由局 · 自选骰子与徽章</option></select></label>
      <label>目标分<select aria-label="好友目标分" disabled={viewer !== 'host' || pending} value={state.target} onChange={(e) => command({ type: 'CONFIG', mode: state.mode, target: Number(e.target.value) })}>{TARGET_SCORE_OPTIONS.map((target) => <option key={target}>{target}</option>)}</select></label></div>
      <p>本局先手：{state.match % 2 === 0 ? '房主' : '朋友'}。双方准备后自动开始；改变装备或规则需要重新准备。</p>
      {state.mode === 'free' && <LoadoutEditor value={{ dice: state.players[viewer].dice, modifiers: state.players[viewer].modifiers }} inventory={DUEL_INVENTORY} badgeLimit={2} disabled={pending} onChange={(draft) => command({ type: 'LOADOUT', dice: draft.dice, modifiers: draft.modifiers })} />}
      <details className="friend-roster"><summary>双方装备 · 房主{state.players.host.ready ? '已准备' : '整备中'} · 朋友{state.players.guest.ready ? '已准备' : '整备中'}</summary><div className="friend-room-grid">{(['host','guest'] as const).map((seat) => <article key={seat}><h3>{seat === 'host' ? '房主' : '朋友'}{seat === viewer ? '（你）' : ''} · {state.players[seat].ready ? '已准备' : '整备中'}</h3><p>{state.players[seat].dice.map((id) => getDieDefinition(id).name).join(' · ')}</p><p>{state.players[seat].modifiers.map((id) => getModifier(id)?.name).join(' · ') || '无徽章'}</p></article>)}</div></details>
      <button className="night-primary" disabled={pending} onClick={() => command({ type: 'READY', ready: !state.players[viewer].ready })}>{state.players[viewer].ready ? '取消准备' : '准备好了'}</button>
    </section>}
    {state.stage !== 'lobby' && <>
      <div className="friend-score"><div>你<strong>{state.players[viewer].score}</strong></div><div>目标<strong>{state.target}</strong></div><div>朋友<strong>{state.players[otherSeat(viewer)].score}</strong></div></div>
      <div className="friend-table"><TableStage state={visual} presentation={presentation} selectionValid={choice.valid} onToggleDie={toggle} />
        {paused && !rules && !leaving && <div className="friend-pause"><div><h2>你的画面已暂停</h2><p>朋友仍可操作，回来后显示最新局面。</p><button disabled={!canResume} onClick={resume}>继续</button></div></div>}
      </div>
      <section className="friend-dock"><p role="status">{state.notice} {state.stage === 'playing' ? state.active === viewer ? '轮到你。' : '等待朋友操作。' : ''}</p>
        {state.stage === 'playing' ? <><strong>本回合 {state.game.turnScore} · 本次 {choice.valid ? choice.score : 0} · 可落袋 {choice.valid ? choice.bankTotal : 0}</strong>{shownIds.length > 0 && !choice.valid && <p role="status">选择尚未完整计分：请调整 {choice.unusedDice.map((value) => value === 'JOKER' ? '骷髅' : value).join('、')}。</p>}
          <ActionBar phase={visual.phase} humanTurn={state.active === viewer} selectionValid={choice.valid} hasSelection={selectedIds.length > 0} canBank={choice.valid} abilities={getModifiers(state.players[viewer].modifiers)} modifierUsage={state.active === viewer ? state.game.modifierUsage : state.players[viewer].usage} abilityDisabledReasons={abilityReasons({ ...state.game, rolledDice: game.rolledDice })} paused={blocked} onRoll={() => command({ type: 'ROLL', selectedIds })} onBank={() => command({ type: 'BANK', selectedIds })} onUseModifier={(modifierId) => command({ type: 'ABILITY', modifierId, selectedIds })} />
          <details className="friend-details"><summary>计分明细与风险</summary><ScoreExplanation state={{ ...state.game, rolledDice: game.rolledDice }} /></details>
        </> : <><h2>{state.winner === viewer ? '你赢了！' : '朋友赢了这一局。'}</h2><button disabled={status !== 'connected' || pending} onClick={() => command({ type: 'REMATCH' })}>再来一局 · 交换先手</button></>}
      </section>
    </>}
    {rules && <RulesModal onClose={() => setRules(false)} />}
    {leaving && <AccessibleDialog ariaLabelledBy="leave-friends" className="friend-panel" onClose={() => setLeaving(false)}><h2 id="leave-friends">离开好友对局？</h2><p>当前联机会话会结束；单机存档不受影响。</p><button onClick={onHome}>离开并返回酒馆</button><button onClick={() => setLeaving(false)}>留在对局</button></AccessibleDialog>}
  </main>
}
