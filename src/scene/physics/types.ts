export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]
export interface Pose { position: Vec3; rotation: Quat }
export interface Trajectory {
  step: number
  frames: Pose[][]
  impacts: { time: number; strength: number }[]
  releases?: number[]
}
export interface PhysicsRequest { id: number; count: number; seed: number; player?: 'human' | 'ai'; origin?: Vec3 }
export interface PhysicsResponse { id: number; trajectory?: Trajectory }

import { TABLE } from '../layout'
export const DIE_SIZE = TABLE.die
export const ARENA_X = TABLE.arenaX
export const ARENA_Z = TABLE.arenaZ
