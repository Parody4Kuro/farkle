export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]
export interface Pose { position: Vec3; rotation: Quat }
export interface Trajectory {
  step: number
  frames: Pose[][]
  impacts: { time: number; strength: number }[]
}
export interface PhysicsRequest { id: number; count: number; seed: number }
export interface PhysicsResponse { id: number; trajectory?: Trajectory }

export const DIE_SIZE = 0.94
export const ARENA_X = 5.4
export const ARENA_Z = 2.5
