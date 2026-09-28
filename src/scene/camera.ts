import type { Vec3 } from './physics/types'
import { TABLE } from './layout'

export type TableView = 'table' | 'opponent'
export type CameraShot = TableView | 'cup' | 'ledger' | 'hands'
export function cameraPreset(view: CameraShot, aspect = 16 / 9, player: 'human' | 'ai' = 'human') {
  const side = player === 'human' ? 1 : -1
  const presets: Record<CameraShot, { position: Vec3; target: Vec3; fov: number }> = {
    table: { position: [0, 0.35, 0.33], target: [0, 0, 0.015], fov: 46 },
    opponent: { position: [0, 0.42, 0.8], target: [0, 0.42, -0.56], fov: 43 },
    cup: { position: [0.10, 0.37, 0.34], target: [-0.12 * side, 0.21, 0.13 * side], fov: 48 },
    ledger: { position: [0.14, 0.36, 0.43], target: [0.29, 0.012, 0.17], fov: 44 },
    hands: { position: [0, 0.27, 0.38], target: [0, 0.04, -0.19], fov: 48 },
  }
  const { target, position: base, fov } = presets[view]
  const scale = Math.max(1, 1.5 / aspect)
  const position = base.map((v, i) => target[i] + (v - target[i]) * scale) as Vec3
  return { position, target, fov }
}

/** Same table projection as the renderer, including physical die dimensions. */
export function tableFootprint(position: Vec3) {
  const { position: eye, target, fov } = cameraPreset('table')
  const fy = target[1] - eye[1], fz = target[2] - eye[2], length = Math.hypot(fy, fz)
  const y = fy / length, z = fz / length, tan = Math.tan(fov * Math.PI / 360)
  const points: { x: number; y: number }[] = []
  for (const dx of [-TABLE.die / 2, TABLE.die / 2]) for (const dy of [-TABLE.die / 2, TABLE.die / 2]) for (const dz of [-TABLE.die / 2, TABLE.die / 2]) {
    const py = position[1] + dy - eye[1], pz = position[2] + dz - eye[2]
    const depth = py * y + pz * z
    points.push({ x: (position[0] + dx) / (depth * tan * 16 / 9), y: (-py * z + pz * y) / (depth * tan) })
  }
  return { left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)), top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)) }
}
