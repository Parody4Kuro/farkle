import { useState } from 'react'
import type { AdventureRun } from '../game/adventure'
import { OPPONENTS } from '../game/opponents'
import { createInitialState } from '../game/rules'
import { RollPresentation } from '../presentation/rollPresentation'
import { unlockedOrigins, type AdventureProfile, type ComfortPreferences } from '../storage/adventureStorage'
import { ComfortDialog } from './ComfortDialog'
import { TableStage } from './TableStage'

export function TavernLobby({ saved, profile, comfort, onStart, onContinue, onClassic, onComfort, warning }: {
  saved: AdventureRun | null; profile: AdventureProfile; comfort: ComfortPreferences
  onStart: (origin: string) => void; onContinue: () => void; onClassic: () => void
  onComfort: (next: ComfortPreferences) => void; warning: string
}) {
  const [presentation] = useState(() => new RollPresentation())
  const [preview] = useState(createInitialState)
  const [origin, setOrigin] = useState('traveller')
  const [settings, setSettings] = useState(false)
  const [memories, setMemories] = useState(false)
  const [replace, setReplace] = useState(false)
  const ongoing = saved && !['won', 'lost'].includes(saved.stage)
  const origins = unlockedOrigins(profile)
  return <main className={`tavern-lobby ${comfort.largeText ? 'large-text' : ''}`}>
    <div className="lobby-scene"><TableStage state={preview} presentation={presentation} selectionValid={false} onToggleDie={() => {}}
      opponent={OPPONENTS[3]} view="opponent" appearance={comfort.appearance} /></div>
    <div className="lobby-shade" />
    <header className="lobby-header"><span>THE CROOKED CROWN <b>✦</b> 歪皇冠酒馆</span><button className="night-text" onClick={() => setSettings(true)}>偏好设置 ⚙</button></header>
    <section className="lobby-copy">
      <span className="eyebrow">A TABLE. A CHANCE. A STORY.</span>
      <h1>TAVERN<br /><em>BONES</em></h1>
      <div className="lobby-rule" />
      <h2>一把骰子，一夜故事。</h2>
      <p>炉火还亮着。四张桌子，四位陌生人。<br />带上你的胆量，看看今晚能走多远。</p>
      {origins.length > 1 && <label className="origin-picker">今晚的行囊<select value={origin} onChange={(e) => setOrigin(e.target.value)}>{origins.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select><small>{origins.find((o) => o.id === origin)?.description}</small></label>}
      {ongoing && !replace && <button className="night-primary" onClick={onContinue}>继续这一夜 <small>第 {saved.table + 1} 桌 · 失利 {saved.losses}/2</small><span aria-hidden="true">→</span></button>}
      {replace ? <div className="replace-run"><p>开始新的一夜将替换当前冒险存档，已解锁的收藏会保留。</p><button className="night-primary" onClick={() => onStart(origin)}>重新入夜</button><button className="night-text" onClick={() => setReplace(false)}>保留当前旅程</button></div>
        : <button className={ongoing ? 'night-secondary' : 'night-primary'} onClick={() => ongoing ? setReplace(true) : onStart(origin)}>开始酒馆之夜 <span aria-hidden="true">→</span></button>}
      <div className="lobby-links"><button onClick={onClassic}>经典对局</button><span>·</span><button onClick={() => setMemories(!memories)} aria-expanded={memories}>酒馆记忆 {profile.memories.length}/4</button></div>
      <p className="lobby-meta">四桌冒险 · 自选打法 · 随时离席续玩</p>
      {warning && <p className="night-warning" role="status">{warning}</p>}
    </section>
    <div className="lobby-host"><span>「最后一桌，我等你。」</span><small>布兰 / 歪皇冠老板</small></div>
    <footer className="lobby-footer"><span>原创骰组冒险 / 完全本地运行</span><span>{profile.nights ? `${profile.nights} 夜故事 · ${profile.wins} 次通关 · 最高落袋 ${profile.peak}` : '先选一枚核心，再开始今晚的故事。'}</span></footer>
    {memories && <aside className="memory-book" aria-label="酒馆记忆"><button className="night-text" onClick={() => setMemories(false)} aria-label="合上记忆簿">合上 ×</button><span className="eyebrow">PEOPLE YOU HAVE MET</span><h2>熟悉的面孔</h2>
      {OPPONENTS.map((o) => <article key={o.id}><h3>{profile.memories.includes(o.id) ? o.name : '尚未相识'}<small>{o.title}</small></h3><p>{profile.memories.includes(o.id) ? o.story : '完成一夜旅程后，遇见过的人会留下故事。'}</p></article>)}
      <p className="unlock-note">第一夜结束：商路旧识起始套装<br />首次通关：夜行旅人套装与月下骰盅</p>
    </aside>}
    {settings && <ComfortDialog value={comfort} onChange={onComfort} onClose={() => setSettings(false)} appearanceUnlocked={profile.wins > 0} />}
  </main>
}
