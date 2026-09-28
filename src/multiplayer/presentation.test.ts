import { describe, expect, it } from 'vitest'
import { applyMatchCommand, createDuel, type DuelState } from '../game/duel'
import { friendSequence, parseActionSummary, summarizeAction } from './presentation'

function selecting(): DuelState {
  let state = createDuel()
  const draw = () => []
  state = applyMatchCommand(state, 'host', { type: 'READY', ready: true }, draw)
  state = applyMatchCommand(state, 'guest', { type: 'READY', ready: true }, draw)
  return { ...state, game: { ...state.game, phase: 'selecting', turnScore: 200, rolledDice: Array.from({ length: 7 }, (_, i) => ({ id: 'd' + i, definitionId: 'standard', value: 1 as const, selected: false })) } }
}
describe('optional friend presentation summaries', () => {
  it('keeps banking authoritative once and maps the same action to each viewer', () => {
    const before = selecting(), command = { type: 'BANK' as const, selectedIds: ['d0'] }
    const after = applyMatchCommand(before, 'host', command, () => [])
    const summary = summarizeAction(before, after, 'host', command)!
    expect(parseActionSummary(summary, after)).toEqual(summary)
    const host = friendSequence(summary, after, 'host'), guest = friendSequence(summary, after, 'guest')
    expect(after.players.host.score).toBe(300)
    expect(host[0].type === 'action' && host[0].action.before.rolledDice).toHaveLength(7)
    expect(host[0].type === 'action' && host[0].action.after.scores.human).toBe(300)
    expect(guest[0].type === 'action' && guest[0].action.after.scores.ai).toBe(300)
    expect(guest[0].type === 'action' && guest[0].action.player).toBe('ai')
    friendSequence(summary, after, 'guest'); expect(after.players.host.score).toBe(300)
  })
  it('orders seven-die Hot Dice, physical release and bust while retaining lost points', () => {
    const before = selecting(), command = { type: 'ROLL' as const, selectedIds: beforeIds() }
    const after = applyMatchCommand(before, 'host', command, (ids) => ids.map((id, i) => ({ id: 'r' + i, definitionId: id, value: [2,2,3,3,4,6][i] as 2 | 3 | 4 | 6, selected: false })))
    const items = friendSequence(summarizeAction(before, after, 'host', command)!, after, 'guest')
    expect(items.map((item) => item.type === 'action' ? item.action.kind : item.type)).toEqual(['hot','roll','bust'])
    const bust = items[2]; expect(bust.type === 'action' && bust.action.amount).toBeGreaterThan(200)
    expect(after.game.turnScore).toBe(0)
    expect(after.active).toBe('guest')
  })
  it('ignores absent, stale and malformed optional metadata without rejecting valid state', () => {
    const before = selecting(), cmd = { type: 'BANK' as const, selectedIds: ['d0'] }, after = applyMatchCommand(before, 'host', cmd, () => [])
    const summary = summarizeAction(before, after, 'host', cmd)!
    for (const value of [undefined, {}, { ...summary, sequence: after.revision - 1 }, { ...summary, before: {} }, { ...summary, scores: { host: NaN, guest: 0 } }]) expect(parseActionSummary(value, after)).toBeUndefined()
  })
})
function beforeIds() { return Array.from({ length: 7 }, (_, i) => 'd' + i) }
