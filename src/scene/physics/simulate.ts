import RAPIER from '@dimforge/rapier3d-compat'
import { topFace } from './faces'
import { ARENA_X, ARENA_Z, DIE_SIZE, type Pose, type Trajectory, type Vec3 } from './types'
import { tableFootprint } from '../camera'
import { actorSide, cupMouth, RELEASE_INTERVAL, TABLE } from '../layout'
import type { PlayerId } from '../../game/types'

let initialization: Promise<void> | undefined
export function initPhysics() {
  initialization ??= RAPIER.init()
  return initialization
}

export function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function validLanding(poses: Pose[]): boolean {
  const footprints = poses.map((pose) => tableFootprint(pose.position))
  return poses.every((pose, i) => {
    const [x, y, z] = pose.position
    if (![...pose.position, ...pose.rotation].every(Number.isFinite)) return false
    if (Math.abs(Math.hypot(...pose.rotation) - 1) > 0.0001) return false
    if (Math.abs(x) > ARENA_X - DIE_SIZE / 2 || Math.abs(z) > ARENA_Z - DIE_SIZE / 2) return false
    if (y < 0.014 || y > 0.019 || topFace(pose.rotation).alignment < 0.995) return false
    // The fixed 45-degree camera compresses depth. Keep projected hit areas apart.
    return poses.slice(i + 1).every((other, j) => {
      const dx = x - other.position[0]
      const dz = (z - other.position[2]) * Math.SQRT1_2
      const a = footprints[i], b = footprints[i + j + 1]
      const separated = a.right + 0.008 < b.left || b.right + 0.008 < a.left || a.bottom + 0.008 < b.top || b.bottom + 0.008 < a.top
      return Math.hypot(dx, dz) > 0.038 && separated
    })
  })
}

/** Actual rigid-body simulation; never consumes the game's outcome RNG. */
export function simulate(count: number, seed: number, player: PlayerId = 'human', origin: Vec3 = cupMouth(player)): Trajectory | undefined {
  if (!Number.isInteger(count) || count < 1 || count > 7) return undefined
  const random = seededRandom(seed)
  const side = actorSide(player)
  const releases = Array.from({ length: count }, (_, i) => i * RELEASE_INTERVAL)
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = 1 / 120
  world.lengthUnit = 0.032
  const events = new RAPIER.EventQueue(true)
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.7, 0.02, 0.5).setTranslation(0, -0.02, 0).setFriction(0.8))
    for (const sign of [-1, 1]) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.004, 0.016, ARENA_Z).setTranslation(sign * ARENA_X, 0.004, 0))
      world.createCollider(RAPIER.ColliderDesc.cuboid(ARENA_X, 0.016, 0.004).setTranslation(0, 0.004, sign * ARENA_Z))
    }
    const bodies = Array.from({ length: count }, (_, i) => {
      const rotation = [random(), random(), random(), random()]
      const norm = Math.hypot(...rotation) || 1
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...origin)
        .setRotation({ x: rotation[0] / norm, y: rotation[1] / norm, z: rotation[2] / norm, w: rotation[3] / norm })
        .setLinvel((random() - 0.3) * 0.65 * side, -0.06, -(0.2 + random() * 0.48) * side)
        .setAngvel({ x: (random() - 0.5) * 28, y: (random() - 0.5) * 28, z: (random() - 0.5) * 28 })
        .setLinearDamping(0.8).setAngularDamping(0.7).setCcdEnabled(true))
      world.createCollider(RAPIER.ColliderDesc.roundCuboid(DIE_SIZE / 2 - TABLE.radius, DIE_SIZE / 2 - TABLE.radius, DIE_SIZE / 2 - TABLE.radius, TABLE.radius)
        .setRestitution(0.32).setFriction(0.75)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body)
      if (i > 0) body.setEnabled(false)
      return body
    })
    const frames: Pose[][] = []
    const impacts: Trajectory['impacts'] = []
    const record = () => bodies.map((body): Pose => {
      const p = body.translation(), q = body.rotation()
      return { position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w] }
    })
    frames.push(record())
    for (let frame = 1; frame <= 360; frame++) {
      for (let i = 1; i < bodies.length; i++) if (!bodies[i].isEnabled() && frame / 120 >= releases[i]) bodies[i].setEnabled(true)
      world.step(events)
      events.drainCollisionEvents((_a, _b, started) => {
        if (started && frame / 120 - (impacts.at(-1)?.time ?? -1) > 0.06) {
          impacts.push({ time: frame / 120, strength: Math.max(0.2, 1 - frame / 400) })
        }
      })
      // Record at 60 Hz; playback interpolates independently of render frequency.
      if (frame % 2 === 0) frames.push(record())
      if (frame > 180 && frame % 2 === 0 && bodies.every((body) => {
        const v = body.linvel(), a = body.angvel()
        return Math.hypot(v.x, v.y, v.z) < 0.001 && Math.hypot(a.x, a.y, a.z) < 0.025
      })) break
    }
    if (!validLanding(frames.at(-1)!)) return undefined
    return { step: 1 / 60, frames, impacts, releases }
  } finally {
    events.free()
    world.free()
  }
}
