import type { Vec3 } from './physics/types'

export type TableView = 'table' | 'opponent'
export function cameraPreset(view: TableView, aspect = 16 / 9) {
  const target: Vec3 = view === 'table' ? [0, 0, 0.4] : [0, 1.65, -1.8]
  const base: Vec3 = view === 'table' ? [0, 8.6, 10] : [0, 4.7, 11.8]
  const scale = Math.max(1, 1.55 / aspect)
  const position = base.map((v, i) => target[i] + (v - target[i]) * scale) as Vec3
  return { position, target, fov: 50 }
}

/** Shared normalized projection for landing validation; does not load Three into the physics worker. */
export function tableFootprint(position: Vec3) {
  const { position: eye, target, fov } = cameraPreset('table')
  const fy = target[1] - eye[1], fz = target[2] - eye[2], length = Math.hypot(fy, fz)
  const y = fy / length, z = fz / length, tan = Math.tan(fov * Math.PI / 360)
  const points: { x: number; y: number }[] = []
  for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) {
    const py = position[1] + dy - eye[1], pz = position[2] + dz - eye[2]
    const depth = py * y + pz * z
    points.push({ x: (position[0] + dx) / (depth * tan * 16 / 9), y: (-py * z + pz * y) / (depth * tan) })
  }
  return { left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)) }
}
