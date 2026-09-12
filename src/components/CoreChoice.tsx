import { useEffect, useRef } from 'react'
import { getModifier } from '../game/modifiers'

export function CoreChoice({ offers, onChoose, scoringVersion }: { offers: string[]; onChoose: (id: string) => void; scoringVersion?: number }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="night-panel core-panel" aria-labelledby="core-title">
    <span className="eyebrow">CHOOSE YOUR WAY</span>
    <h1 id="core-title" ref={heading} tabIndex={-1}>今夜，按你的打法来。</h1>
    <p>选一枚核心带入行囊并佩戴。核心占用两个徽章位之一，最多佩戴一枚；每桌入座前都可卸下或重新搭配。</p>
    <div className="reward-grid">{offers.map((id) => {
      const core = getModifier(id, scoringVersion)!
      return <article className="loot-card core-card" key={id}>
        <span className="loot-art" aria-hidden="true">{core.symbol}</span><h2>{core.name}</h2>
        <p className="core-benefit">收益 · {core.benefit}</p><p className="core-cost">代价 · {core.cost}</p>
        <p>{core.example}</p><button className="night-primary" onClick={() => onChoose(id)}>选择{core.name}</button>
      </article>
    })}</div>
    <p>六颗起始骰已经备好。之后赢得的骰子与徽章都会留在本夜行囊里。</p>
  </section>
}
