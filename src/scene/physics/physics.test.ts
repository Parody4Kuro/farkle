import { beforeAll, describe, expect, it } from 'vitest'
import { Euler, Quaternion, Vector3 } from 'three'
import { JOKER, type DieFace } from '../../game/types'
import { composeRotation, FACE_NORMALS, faceOffset, topFace } from './faces'
import { fallbackTrajectory } from './PhysicsClient'
import { initPhysics, simulate, validLanding } from './simulate'
import type { Quat } from './types'

describe('visible dice faces', () => {
  it('maps every outcome to the top for all cube orientations without changing face layout', () => {
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) {
      const landed = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.37)
        .multiply(new Quaternion().setFromEuler(new Euler(x * Math.PI / 2, y * Math.PI / 2, z * Math.PI / 2)))
        .toArray() as Quat
      for (const value of [1, 2, 3, 4, 5, 6, JOKER] as const) {
        const offset = faceOffset(landed, value)
        const result = topFace(composeRotation(landed, offset))
        expect(result.face).toBe(value === JOKER ? 6 : value)
        expect(result.alignment).toBeCloseTo(1, 8)
        // A rigid cube symmetry preserves six distinct faces and opposite pairs.
        const normals = Object.values(FACE_NORMALS).map((normal) => new Vector3(...normal).applyQuaternion(new Quaternion(...offset)))
        for (let i = 0; i < 6; i++) expect(normals[i].dot(normals[5 - i])).toBeCloseTo(-1)
      }
    }
  })

  it('supports a Joker definition marking any of the six faces', () => {
    for (let face = 1; face <= 6; face++) {
      expect(topFace(faceOffset([0, 0, 0, 1], JOKER, face as DieFace)).face).toBe(face)
    }
  })
})

describe('physical trajectories', () => {
  beforeAll(initPhysics)

  it('ships verified, finite, fully landed fallback simulations for one through seven dice', () => {
    for (let count = 1; count <= 7; count++) {
      const trajectory = fallbackTrajectory(count)
      expect(trajectory.frames.length).toBeGreaterThan(30)
      expect(trajectory.frames.length).toBeLessThanOrEqual(181)
      expect(trajectory.impacts.length).toBeGreaterThan(0)
      expect(trajectory.frames.every((frame) => frame.length === count)).toBe(true)
      for (const pose of trajectory.frames.flat()) expect(Math.hypot(...pose.rotation)).toBeCloseTo(1, 4)
      expect(trajectory.frames[0].every((pose) => pose.position[1] > 2)).toBe(true)
      expect(validLanding(trajectory.frames.at(-1)!)).toBe(true)
    }
  })

  it('reproduces a real seven-body simulation from its independent seed', () => {
    const a = simulate(7, 70094)
    const b = simulate(7, 70094)
    expect(a).toBeDefined()
    expect(a).toEqual(b)
    expect(validLanding(a!.frames.at(-1)!)).toBe(true)
  })

  it('rejects tilted, stacked, obscured and out-of-arena results', () => {
    const valid = fallbackTrajectory(1).frames.at(-1)![0]
    expect(validLanding([{ ...valid, position: [0, 1.4, 0] }])).toBe(false)
    expect(validLanding([{ ...valid, position: [10, 0.47, 0] }])).toBe(false)
    expect(validLanding([{ ...valid, rotation: new Quaternion().setFromEuler(new Euler(0.4, 0, 0)).toArray() as Quat }])).toBe(false)
    expect(validLanding([valid, valid])).toBe(false)
    expect(simulate(8, 1)).toBeUndefined()
  })
})
