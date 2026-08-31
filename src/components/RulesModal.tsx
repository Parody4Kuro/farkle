import { MODIFIERS } from '../game/modifiers'
import { SINGLE_SCORES, STRAIGHT_RULES, kindScore } from '../game/scoring'
import type { DieFace } from '../game/types'
import { AccessibleDialog } from './AccessibleDialog'

const KIND_FACES: DieFace[] = [1, 2, 3, 4, 5, 6]

interface RulesModalProps {
  onClose: () => void
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <AccessibleDialog ariaLabelledBy="rules-heading" className="rules-dialog" onClose={onClose}>
      <section className="rules-modal">
        <button className="modal-close" type="button" aria-label="关闭规则说明" onClick={onClose}>×</button>
        <span className="eyebrow">酒馆规则</span>
        <h2 id="rules-heading" tabIndex={-1} data-autofocus>如何赢下这局</h2>
        <p className="settings-intro">选择本次新投出的计分骰，决定继续冒险或保存分数。率先达到目标分的一方获胜。</p>

        <div className="rules-grid">
          <article className="rules-card">
            <h3>基础计分</h3>
            <dl className="score-reference">
              <div><dt>单颗 1</dt><dd>{SINGLE_SCORES[1]} 分</dd></div>
              <div><dt>单颗 5</dt><dd>{SINGLE_SCORES[5]} 分</dd></div>
              {KIND_FACES.map((face) => (
                <div key={face}><dt>三个 {face}</dt><dd>{kindScore(face, 3)} 分</dd></div>
              ))}
            </dl>
            <p>四同、五同、六同每增加一颗，分数翻倍。同点数组合最多使用六颗骰子。</p>
          </article>

          <article className="rules-card">
            <h3>顺子与特殊骰</h3>
            <dl className="score-reference">
              {STRAIGHT_RULES.slice().reverse().map((rule) => (
                <div key={rule.sequence.join('-')}>
                  <dt>{rule.sequence.join(' · ')}</dt><dd>{rule.score} 分</dd>
                </div>
              ))}
            </dl>
            <p>Joker 的 ☠ 面没有单独分数，但可以替代同点数组合或顺子中缺少的任意点数。</p>
          </article>

          <article className="rules-card">
            <h3>冒险与收手</h3>
            <p><strong>Bust／爆骰：</strong>新投出的骰子完全无法计分时，本回合尚未保存的分数全部丢失。</p>
            <p><strong>Hot Dice：</strong>当前所有可用骰都成功计分时，重新获得完整骰组并继续同一回合。</p>
            <p>已锁定骰不能和下一次投出的骰子重新组成组合。保存分数前，本次投掷也必须选择合法计分骰。</p>
          </article>

          <article className="rules-card">
            <h3>徽章</h3>
            <ul className="rules-modifiers">
              {MODIFIERS.map((modifier) => (
                <li key={modifier.id}><span aria-hidden="true">{modifier.symbol}</span><div><strong>{modifier.name}</strong><p>{modifier.description}</p></div></li>
              ))}
            </ul>
          </article>
        </div>

        <button className="primary-action rules-close-action" type="button" onClick={onClose}>明白了</button>
      </section>
    </AccessibleDialog>
  )
}
