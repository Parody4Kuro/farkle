import { createDuel } from '../game/duel'
import { expect, it } from 'vitest'
import { decodeInvitation, encodeInvitation, isDuelSnapshot, parseCommand, PROTOCOL_VERSION, RULES_VERSION, type Invitation } from './protocol'
const offer: Invitation = { protocol: PROTOCOL_VERSION, rules: RULES_VERSION, kind: 'offer', session: 'a'.repeat(36), secret: 'b'.repeat(36), channel: 'c'.repeat(36), resume: false, sdp: 'v=0\r\na=测试\r\n' }
it('round trips full SDP and rejects wrong type, version and malformed inputs', () => {
  expect(decodeInvitation(encodeInvitation(offer),'offer')).toEqual(offer)
  expect(() => decodeInvitation(encodeInvitation(offer),'answer')).toThrow()
  expect(() => decodeInvitation(encodeInvitation({ ...offer, rules: 'old' }),'offer')).toThrow(/版本/)
  for (const invalid of ['TB1.broken','anything','x'.repeat(140000)]) expect(() => decodeInvitation(invalid,'offer')).toThrow()
})
it('accepts intentions only and validates all externally supplied arrays', () => {
  expect(parseCommand({ type: 'BANK', selectedIds: ['a'], score: 999999 })).toEqual({ type: 'BANK', selectedIds: ['a'] })
  for (const invalid of [null, { type: 'ROLL_RESOLVED', dice: [] }, { type: 'ROLL', selectedIds: [1] }, { type: 'LOADOUT', dice: Array(7).fill('a'), modifiers: [] }]) expect(() => parseCommand(invalid)).toThrow()
})

it('rejects malformed authoritative snapshots before they reach renderers', () => {
  const state = createDuel()
  expect(isDuelSnapshot(JSON.parse(JSON.stringify(state)))).toBe(true)
  expect(isDuelSnapshot({ ...state, game: { ...state.game, rolledDice: [null] } })).toBe(false)
  expect(isDuelSnapshot({ ...state, players: { ...state.players, guest: { ...state.players.guest, score: -100 } } })).toBe(false)
  expect(isDuelSnapshot({ ...state, revision: NaN })).toBe(false)
})
