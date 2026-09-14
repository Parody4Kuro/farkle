import { expect, it } from 'vitest'
import { applyMatchCommand, createDuel, duelView, type DuelState, type MatchCommand, type SeatId } from './duel'
import type { DiceValue } from './types'
let serial = 0
const draw = (values: DiceValue[]) => (ids: string[]) => ids.map((definitionId, i) => ({ id: `d${++serial}`, definitionId, value: values[i % values.length], selected: false }))
const command = (s: DuelState, seat: SeatId, c: MatchCommand, values: DiceValue[] = [1]) => applyMatchCommand(s, seat, c, draw(values))
const ready = (s = createDuel()) => command(command(s, 'host', { type: 'READY', ready: true }), 'guest', { type: 'READY', ready: true })
const ids = (s: DuelState) => s.game.rolledDice.map((d) => d.id)
it('validates actor, current roll consumption and banks identically for both seats', () => {
  let s = ready()
  expect(() => command(s, 'guest', { type: 'ROLL', selectedIds: [] })).toThrow(/等待/)
  s = command(s, 'host', { type: 'ROLL', selectedIds: [] }, [1,2,3,4,6,2])
  expect(() => command(s, 'host', { type: 'BANK', selectedIds: ids(s).slice(0,2) })).toThrow(/合法/)
  s = command(s, 'host', { type: 'BANK', selectedIds: [ids(s)[0]] })
  expect(s.players.host.score).toBe(100); expect(s.active).toBe('guest')
  s = command(s, 'guest', { type: 'ROLL', selectedIds: [] }, [5,2,3,4,6,2])
  s = command(s, 'guest', { type: 'BANK', selectedIds: [ids(s)[0]] })
  expect(s.players.guest.score).toBe(50); expect(duelView(s, 'guest').scores).toEqual({ human: 50, ai: 100 })
})
it('retains hot-dice turn points until a bust and never combines previous rolls', () => {
  let s = command(ready(), 'host', { type: 'ROLL', selectedIds: [] }, [1,2,3,4,5,6])
  const old = ids(s)
  s = command(s, 'host', { type: 'ROLL', selectedIds: old }, [1,2,3,4,6,2])
  expect(s.game.turnScore).toBe(1500)
  expect(() => command(s, 'host', { type: 'BANK', selectedIds: [old[0]] })).toThrow(/过期/)
  s = command(s, 'host', { type: 'ROLL', selectedIds: [ids(s)[0]] }, [2,3,4,6,2])
  expect(s.active).toBe('guest'); expect(s.players.host.score).toBe(0); expect(s.game.turnScore).toBe(0)
})
it('gives either owner seven dice and preserves independent per-game ability usage', () => {
  let s = command(createDuel(), 'host', { type: 'CONFIG', mode: 'free', target: 10000 })
  for (const seat of ['host','guest'] as const) s = command(s, seat, { type: 'LOADOUT', dice: Array(6).fill('standard'), modifiers: ['loaded-hand','double-down'] })
  s = ready(s)
  for (const seat of ['host','guest'] as const) {
    s = command(s, seat, { type: 'ROLL', selectedIds: [] }, [1,2,3,4,6,2,3]); expect(ids(s)).toHaveLength(7)
    s = command(s, seat, { type: 'ABILITY', modifierId: 'double-down', selectedIds: [ids(s)[0]] })
    expect(() => command(s, seat, { type: 'BANK', selectedIds: [] })).toThrow(/冻结/)
    s = command(s, seat, { type: 'BANK', selectedIds: [ids(s)[0]] })
    expect(s.players[seat].score).toBe(200); expect(s.players[seat].usage.game['double-down']).toBe(1)
  }
  s = command(s, 'host', { type: 'ROLL', selectedIds: [] }, [1,2,3,4,6,2,3])
  expect(() => command(s, 'host', { type: 'ABILITY', modifierId: 'double-down', selectedIds: [ids(s)[0]] })).toThrow(/不能使用/)
})
it('resets readiness on configuration changes and alternates first player on rematch', () => {
  let s = command(createDuel(), 'host', { type: 'READY', ready: true })
  s = command(s, 'host', { type: 'CONFIG', mode: 'fair', target: 2000 }); expect(s.players.host.ready).toBe(false)
  s = command(ready(s), 'host', { type: 'ROLL', selectedIds: [] }, [1])
  s = command(s, 'host', { type: 'BANK', selectedIds: ids(s) }); expect(s.winner).toBe('host')
  s = command(s, 'guest', { type: 'REMATCH' }); s = ready(s); expect(s.active).toBe('guest'); expect(s.players.host.score).toBe(0)
})
it('applies guest core and joker scoring, and rejects duplicate cores', () => {
  let s = command(createDuel(), 'host', { type: 'CONFIG', mode: 'free', target: 10000 })
  expect(() => command(s, 'guest', { type: 'LOADOUT', dice: Array(6).fill('joker'), modifiers: ['core-steady','core-kindred'] })).toThrow(/核心/)
  s = command(s, 'guest', { type: 'LOADOUT', dice: Array(6).fill('joker'), modifiers: ['core-wanderer','loaded-hand'] })
  s = command(ready(s), 'host', { type: 'ROLL', selectedIds: [] }, [2,3,4,6,2,3])
  s = command(s, 'guest', { type: 'ROLL', selectedIds: [] }, [3,3,'JOKER',4,6,2,3])
  s = command(s, 'guest', { type: 'BANK', selectedIds: ids(s).slice(0,3) }); expect(s.players.guest.score).toBe(600)
})
it('uses a bust protector only once per turn and records both fixed roll results', () => {
  let s = command(createDuel(), 'host', { type: 'CONFIG', mode: 'free', target: 4000 })
  s = command(s, 'host', { type: 'LOADOUT', dice: Array(6).fill('standard'), modifiers: ['lucky-charm'] })
  s = command(ready(s), 'host', { type: 'ROLL', selectedIds: [] }, [2,3,4,6,2,3])
  expect(s.rolls).toHaveLength(2); expect(s.rolls[0].protected).toBe(true); expect(s.rolls[1].protected).toBe(false)
  expect(s.active).toBe('guest'); expect(s.players.host.usage.turn['lucky-charm']).toBe(1)
})

it('rejects selecting all seven threes while allowing exactly six', () => {
  let s = command(createDuel(), 'host', { type: 'CONFIG', mode: 'free', target: 10000 })
  s = command(s, 'host', { type: 'LOADOUT', dice: Array(6).fill('standard'), modifiers: ['loaded-hand'] })
  s = command(ready(s), 'host', { type: 'ROLL', selectedIds: [] }, [3])
  expect(() => command(s, 'host', { type: 'BANK', selectedIds: ids(s) })).toThrow(/合法/)
  s = command(s, 'host', { type: 'BANK', selectedIds: ids(s).slice(0,6) })
  expect(s.players.host.score).toBe(2400)
})
