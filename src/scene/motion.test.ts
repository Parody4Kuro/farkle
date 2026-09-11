import { describe, expect, it } from 'vitest'
import { JOKER, type DieInstance } from '../game/types'
import { settleMotion, type Motion } from './motion'
import { fallbackTrajectory } from './physics/PhysicsClient'
import { faceOffset, topFace } from './physics/faces'

describe('interrupted 3D playback', () => {
  it('snaps every airborne die to the original weighted result when playback is cut short', () => {
    const dice: DieInstance[] = [1, 5, JOKER].map((value, i) => ({
      id: String(i), definitionId: value === JOKER ? 'joker' : 'standard',
      value: value as DieInstance['value'], selected: false,
    }))
    const trajectory = fallbackTrajectory(3)
    const offsets = dice.map((die, i) => faceOffset(trajectory.frames.at(-1)![i].rotation, die.value))
    const motion: Motion = {
      poses: new Map(dice.map((die, i) => [die.id, trajectory.frames[4][i]])),
      plan: { id: 4, dice, trajectory, offsets, start: 0, impact: 0 },
    }
    settleMotion(motion, 3)
    expect(motion.plan).toBeDefined()
    settleMotion(motion, 4)
    expect(motion.plan).toBeUndefined()
    dice.forEach((die) => {
      const pose = motion.poses.get(die.id)!
      expect(pose.position[1]).toBeCloseTo(0.47, 1)
      expect(topFace(pose.rotation).face).toBe(die.value === JOKER ? 6 : die.value)
    })
    const settled = [...motion.poses.entries()]
    settleMotion(motion, 4)
    expect([...motion.poses.entries()]).toEqual(settled)
  })
})
