import type { PlayerId } from '../game/types'

/** Metres, shared by meshes, camera validation, cup mouth and Rapier. */
export const TABLE = { die: 0.032, radius: 0.0024, arenaX: 0.25, arenaZ: 0.155, trayZ: 0.222, traySpacing: 0.043 }
export const ROLL_RELEASE = 1.35
export const RELEASE_INTERVAL = 0.065
export const rollSpeed = (fast?: boolean) => fast ? 3.2 : 1
export const actorSide = (player: PlayerId) => player === 'human' ? 1 : -1
export function cupMouth(player: PlayerId): [number, number, number] { return [-0.11 * actorSide(player), 0.165, 0.11 * actorSide(player)] }
export function trayPosition(index: number, player: PlayerId = 'human'): [number, number, number] {
  return [(index - 3) * TABLE.traySpacing, TABLE.die / 2 + 0.003, TABLE.trayZ * actorSide(player)]
}
