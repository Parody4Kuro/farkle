import { Quaternion, Vector3 } from 'three'
import { JOKER, type DiceValue, type DieFace } from '../../game/types'
import type { Quat } from './types'

// Opposite faces add to seven. Joker replaces the definition's marked face.
export const FACE_NORMALS: Record<DieFace, [number, number, number]> = {
  1: [0, 1, 0], 2: [1, 0, 0], 3: [0, 0, 1],
  4: [0, 0, -1], 5: [-1, 0, 0], 6: [0, -1, 0],
}

export function topFace(rotation: Quat): { face: DieFace; alignment: number } {
  const quaternion = new Quaternion(...rotation)
  let best: { face: DieFace; alignment: number } = { face: 1, alignment: -1 }
  for (const key of Object.keys(FACE_NORMALS)) {
    const face = Number(key) as DieFace
    const alignment = new Vector3(...FACE_NORMALS[face]).applyQuaternion(quaternion).y
    if (alignment > best.alignment) best = { face, alignment }
  }
  return best
}

/** A constant cube symmetry, applied before the first visible frame. */
export function faceOffset(finalRotation: Quat, value: DiceValue, jokerFace: DieFace = 6): Quat {
  const face = value === JOKER ? jokerFace : value
  const target = topFace(finalRotation).face
  return new Quaternion().setFromUnitVectors(
    new Vector3(...FACE_NORMALS[face]),
    new Vector3(...FACE_NORMALS[target]),
  ).toArray() as Quat
}

export function composeRotation(body: Quat, offset: Quat): Quat {
  return new Quaternion(...body).multiply(new Quaternion(...offset)).toArray() as Quat
}
