import { Quaternion, Euler, Vector3 } from 'three'
import type { PlayerId } from '../game/types'
import type { RollPresentation } from '../presentation/rollPresentation'
import { actorSide, cupMouth, ROLL_RELEASE, rollSpeed } from './layout'
import { smooth } from '../presentation/ActionPlayback'

export function cupTransform(elapsed: number, player: PlayerId) {
  const side = actorSide(player), mouth = new Vector3(...cupMouth(player))
  const pouring = new Quaternion().setFromEuler(new Euler(-2.05 * side, 0, -.14 * side))
  const pourCenter = mouth.sub(new Vector3(0, .07, 0).applyQuaternion(pouring))
  const rest = new Vector3(-.318 * side, .071, .08 * side)
  const raised = new Vector3(-.145 * side, .255, .16 * side)
  let position = rest.clone(), rotation = new Quaternion()
  if (elapsed >= 0 && elapsed < .32) position.lerp(raised, smooth(elapsed / .32))
  else if (elapsed >= .32 && elapsed < .93) {
    position.copy(raised).add(new Vector3(Math.sin(elapsed * 39) * .012, Math.cos(elapsed * 39) * .018, 0))
    rotation.setFromEuler(new Euler(Math.sin(elapsed * 39) * .18, 0, -.15 * side))
  } else if (elapsed >= .93 && elapsed < ROLL_RELEASE) {
    const p = smooth((elapsed - .93) / (ROLL_RELEASE - .93)); position.copy(raised).lerp(pourCenter, p); rotation.slerp(pouring, p)
  } else if (elapsed >= ROLL_RELEASE && elapsed < 1.92) { position.copy(pourCenter); rotation.copy(pouring) }
  else if (elapsed >= 1.92 && elapsed < 2.55) { const p = smooth((elapsed - 1.92) / .63); position.copy(pourCenter).lerp(rest, p); rotation.copy(pouring).slerp(new Quaternion(), p) }
  return { position, rotation }
}
export function rollElapsed(presentation: RollPresentation) {
  const roll = presentation.getSnapshot()
  return roll && presentation.startedAt >= 0 ? (presentation.playback.now() - presentation.startedAt) / 1000 * rollSpeed(roll.fast) : -1
}
