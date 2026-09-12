import { getModifiers, MODIFIERS } from '../game/modifiers'
import { LEGACY_SCORING_VERSION, SCORING_VERSION } from '../game/scoringVersions'
import { SINGLE_SCORES, STRAIGHT_RULES, kindScore } from '../game/scoring'
import type { DieFace } from '../game/types'
import { AccessibleDialog } from './AccessibleDialog'

const KIND_FACES: DieFace[] = [1, 2, 3, 4, 5, 6]

interface RulesModalProps {
  onClose: () => void
  scoringVersion?: number
}

export function RulesModal({ onClose, scoringVersion = SCORING_VERSION }: RulesModalProps) {
  return (
    <AccessibleDialog ariaLabelledBy="rules-heading" className="rules-dialog" onClose={onClose}>
      <section className="rules-modal">
        <button className="modal-close" type="button" aria-label="关闭规则说明" onClick={onClose}>×</button>
        <span className="eyebrow">酒馆规则</span>
        <h2 id="rules-heading" tabIndex={-1} data-autofocus>如何赢下这局</h2>
        <p className="settings-intro">选择本次新投出的计分骰，决定继续冒险或保存分数。率先达到目标分的一方获胜。下列为基础分，核心的收益与代价会在计分明细中展开。</p>
        {scoringVersion === LEGACY_SCORING_VERSION && <p className="scoring-version-note">本夜沿用旧版计分：铜筹账簿的三个 1 仍得 600 分。新开的一夜采用 500 分的新规则。</p>}

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
              {getModifiers(MODIFIERS.map((modifier) => modifier.id), scoringVersion).map((modifier) => (
                <li key={modifier.id}><span aria-hidden="true">{modifier.symbol}</span><div><strong>{modifier.name}{modifier.adventureOnly ? ' · 酒馆之夜核心' : ''}</strong><p>{modifier.description}</p>{modifier.example && <p>{modifier.example}</p>}</div></li>
              ))}
            </ul>
          </article>
        </div>

        <p>酒馆之夜始终保有六颗基础公平骰，特殊骰另计。每桌入座前可整理六颗骰子和至多两枚徽章，其中核心最多一枚。奖励与换下物品保留在本夜行囊；首次失利在原桌重试，累计两败结束当夜。</p>
        <p>黄金一点先选一颗新投出的骰子；孤注一掷使用后，选择与骰值锁定。失焦、隐藏窗口或打开面板会暂停对局，返回后需点击“继续”。</p>

        <button className="primary-action rules-close-action" type="button" onClick={onClose}>明白了</button>
      </section>
    </AccessibleDialog>
  )
}
