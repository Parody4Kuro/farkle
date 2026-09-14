import { expect, it } from 'vitest'
import { applyMatchCommand, createDuel, type DuelState } from '../game/duel'
import { FriendSession, type FriendSnapshot } from './FriendSession'
interface Harness { snapshot: FriendSnapshot; session: string; channelId: string; receive: (raw: unknown) => void }
const harness = (state: DuelState) => {
  const session = new FriendSession(), internals = session as unknown as Harness
  internals.session = 'session'; internals.channelId = 'channel'; internals.snapshot = { ...session.getSnapshot(), role: 'host', status: 'connected', state }
  const send = (packet: object) => internals.receive(JSON.stringify({ session: 'session', channel: 'channel', ...packet }))
  return { session, send }
}
it('deduplicates remote commands and refuses stale revisions and host-only configuration', () => {
  const { session, send } = harness(createDuel())
  const packet = { type: 'COMMAND', id: 'one', revision: 0, command: { type: 'READY', ready: true } }
  send(packet); expect(session.getSnapshot().state.revision).toBe(1)
  send(packet); expect(session.getSnapshot().state.revision).toBe(1)
  send({ ...packet, id: 'two', command: { type: 'READY', ready: false } }); expect(session.getSnapshot().state.players.guest.ready).toBe(true)
  send({ type: 'COMMAND', id: 'three', revision: 1, command: { type: 'CONFIG', mode: 'free', target: 2000 } }); expect(session.getSnapshot().state.mode).toBe('fair')
})
it('ignores other sessions and cannot accept guest-supplied scores or outcomes', () => {
  const { session, send } = harness(createDuel())
  send({ session: 'another', type: 'LEAVE' }); expect(session.getSnapshot().status).toBe('connected')
  send({ type: 'COMMAND', id: 'forged', revision: 0, command: { type: 'ROLL_RESOLVED', dice: [] } }); expect(session.getSnapshot().state.revision).toBe(0)
  send({ type: 'STATE', state: { revision: 999 } }); expect(session.getSnapshot().state.revision).toBe(0)
})
it('host command authority works without any renderer or animation clock', () => {
  let state = applyMatchCommand(createDuel(), 'host', { type: 'READY', ready: true }, () => [])
  state = applyMatchCommand(state, 'guest', { type: 'READY', ready: true }, () => [])
  const { session } = harness(state)
  session.command({ type: 'ROLL', selectedIds: [] })
  expect(session.getSnapshot().state.rollSerial).toBeGreaterThan(0)
})
