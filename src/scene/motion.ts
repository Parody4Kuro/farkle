import type { DieInstance } from '../game/types'
import { composeRotation } from './physics/faces'
import type { Pose, Quat, Trajectory } from './physics/types'

export interface Motion {
  poses: Map<string, Pose>
  plan?: { trajectory: Trajectory; dice: DieInstance[]; offsets: Quat[]; id: number; start: number; impact: number }
}

/** Early completion (renderer failure, active timeout) must reveal landed, matching dice. */
export function settleMotion(motion: Motion, id?: number) {
  const plan = motion.plan
  if (!plan || (id !== undefined && plan.id !== id)) return
  const final = plan.trajectory.frames.at(-1)!
  plan.dice.forEach((die, i) => {
    motion.poses.set(die.id, {
      position: final[i].position,
      rotation: composeRotation(final[i].rotation, plan.offsets[i]),
    })
  })
  motion.plan = undefined
}
