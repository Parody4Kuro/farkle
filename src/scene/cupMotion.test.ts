import { expect, it } from 'vitest'
import { Vector3 } from 'three'
import { cupTransform } from './cupMotion'
import { cupMouth, ROLL_RELEASE, RELEASE_INTERVAL } from './layout'
import { fallbackTrajectory } from './physics/PhysicsClient'
it('keeps both cup lips at the exact launch origin through all seven staggered releases', () => {
  for (const player of ['human','ai'] as const) for (let i = 0; i < 7; i++) {
    const pose = cupTransform(ROLL_RELEASE + RELEASE_INTERVAL * i, player)
    const mouth = new Vector3(0, .07, 0).applyQuaternion(pose.rotation).add(pose.position)
    expect(mouth.distanceTo(new Vector3(...cupMouth(player)))).toBeLessThan(1e-9)
    expect(new Vector3(...fallbackTrajectory(7, player).frames[0][i].position).distanceTo(mouth)).toBeLessThan(1e-7)
  }
})
