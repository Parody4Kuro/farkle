import type { GameEvent } from '../game/state'
import type { PresentationEvent } from '../scene/sceneTypes'

export interface Cue { kind: string; title: string; subtitle: string; player?: string }

export function isPresentationEvent(event: GameEvent) {
  return ['START_GAME', 'BEGIN_TURN', 'BUST', 'LOCK_SELECTION', 'BANK', 'USE_GOLDEN_ONE', 'USE_DOUBLE_DOWN', 'MARK_MODIFIER_USED'].includes(event.type)
}

export function eventCue({ event }: PresentationEvent): Cue | null {
  switch (event.type) {
    case 'BUST': return { kind: 'bust', title: '爆骰！', subtitle: 'BUST · 好运暂时离席' }
    case 'LOCK_SELECTION': return event.hotDice
      ? { kind: 'hot', title: '手气正热！', subtitle: 'HOT DICE · 再来一整把' }
      : { kind: 'lock', title: '+' + event.score, subtitle: '已收入计分托盘' }
    case 'BANK': return { kind: 'bank', title: '+' + event.turnTotal, subtitle: 'BANK · 落袋为安', player: event.player }
    case 'USE_GOLDEN_ONE': return { kind: 'magic', title: '黄金一点', subtitle: '命运，翻面！' }
    case 'USE_DOUBLE_DOWN': return { kind: 'magic', title: '孤注一掷', subtitle: '这一手，翻倍！' }
    case 'MARK_MODIFIER_USED': return { kind: 'magic', title: '幸运护符', subtitle: '再给好运一次机会' }
    default: return null
  }
}
