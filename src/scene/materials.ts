import { BoxGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, Vector3 } from 'three'
import { FACE_NORMALS } from './physics/faces'
import type { DieFace } from '../game/types'

function pips(value: number): [number, number][] {
  const points: [number, number][] = []
  if (value % 2) points.push([0, 0])
  if (value >= 2) points.push([-.24, -.24], [.24, .24])
  if (value >= 4) points.push([-.24, .24], [.24, -.24])
  if (value === 6) points.push([-.24, 0], [.24, 0])
  return points
}
/** Sculpt the actual surface, with dark pigment inside each recessed bowl. */
function carvedDie(jokerFace?: DieFace, emblem?: string) {
  const geometry = new BoxGeometry(1, 1, 1, 40, 40, 40)
  const positions = geometry.getAttribute('position'), colors: number[] = []
  const inner = new Vector3(), corner = new Vector3()
  const p = new Vector3(), normal = new Vector3(), tint = new Color()
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i)
    inner.copy(p).clampScalar(-.432, .432); corner.copy(p).sub(inner).normalize(); p.copy(inner).addScaledVector(corner, .068)
    let indentation = 0
    for (const [face, n] of Object.entries(FACE_NORMALS)) {
      normal.fromArray(n)
      if (p.dot(normal) < .499) continue
      const u = n[0] ? p.z : p.x, v = n[1] ? p.z : p.y
      if (Number(face) === jokerFace) {
        // Original engraved skull with eyes cut out of its silhouette.
        const skull = (u * u / .052 + (v - .045) ** 2 / .06 < 1 || (Math.abs(u) < .145 && v > -.23 && v < -.04))
        const eyes = (Math.abs(u) - .092) ** 2 / .0028 + (v - .07) ** 2 / .004 < 1
        const teeth = v < -.14 && (Math.abs(u) < .018 || Math.abs(Math.abs(u) - .084) < .014)
        if (skull && !eyes && !teeth) indentation = .033
      } else for (const [x, y] of pips(Number(face))) {
        const distance = Math.hypot(u - x, v - y), radius = .091
        if (distance < radius) indentation = Math.max(indentation, .046 * Math.sqrt(1 - (distance / radius) ** 2))
      }
      // Each weighted die has its own engraved border outside the pip field.
      // These marks never add dots that could be mistaken for a face value.
      const a = Math.abs(u), b = Math.abs(v), edge = Math.max(a, b), along = Math.min(a, b)
      const engraving = emblem === 'lucky-one' ? Math.abs(a - .375) + Math.abs(b - .375) < .040
        : emblem === 'lucky-five' ? edge > .373 && edge < .406 && (Math.floor(along * 32) % 2 === 0)
        : emblem === 'high-roller' ? edge > .35 && edge < .418 && Math.abs(edge - .382 - (along % .15 - .075) * .38) < .014
        : emblem === 'odd-fellow' ? edge > .351 && edge < .425 && Math.abs(Math.sin((edge - .351) * Math.PI / .025)) < .44
        : false
      if (engraving) indentation = Math.max(indentation, .020)
      p.addScaledVector(normal, -indentation)
    }
    positions.setXYZ(i, p.x, p.y, p.z)
    tint.set(indentation > .014 ? '#28201b' : '#ffffff')
    colors.push(tint.r, tint.g, tint.b)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function createArt() {
  const resources: { dispose: () => void }[] = []
  const loader = new TextureLoader()
  const maps = (name: string, repeat: [number, number] = [1, 1]) => {
    const texture = (kind: string) => {
      const t = loader.load(`${import.meta.env.BASE_URL}art/materials/${name}-${kind}.jpg`)
      t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4
      if (kind === 'color') t.colorSpace = SRGBColorSpace
      resources.push(t); return t
    }
    return { map: texture('color'), normalMap: texture('normal'), roughnessMap: texture('roughness'), normalScale: new Vector2(.45, .45) }
  }
  const material = (color: string, roughness = .7, metalness = 0) => {
    const m = new MeshStandardMaterial({ color, roughness, metalness }); resources.push(m); return m
  }
  const wood = material('#c2a884'); Object.assign(wood, maps('wood', [2, 2]))
  const leather = material('#80614e'); Object.assign(leather, maps('leather', [2, 1]))
  const cloth = material('#485b4d'); Object.assign(cloth, maps('fabric', [3, 3]))
  const colors = { wood, woodLight: wood, woodDark: material('#3d261c'), leather, cloth,
    copper: material('#b18b50', .32, .82), parchment: material('#dbc6a0'), wine: material('#382723'),
    wax: material('#ead8b1', .42), dark: material('#201d19'), green: cloth }
  const dice: Record<string, MeshStandardMaterial> = {}
  for (const [id, color] of Object.entries({ standard: '#f0e4c9', 'lucky-one': '#e9bd60', 'lucky-five': '#92bea8', 'high-roller': '#8faac1', 'odd-fellow': '#c79595', joker: '#bea3cb' })) {
    dice[id] = material(color, .28); dice[id].vertexColors = true
  }
  const dieGeometry = carvedDie(), jokerGeometry = carvedDie(6)
  const diceGeometry: Record<string, BoxGeometry> = { standard: dieGeometry, joker: jokerGeometry }
  for (const id of ['lucky-one', 'lucky-five', 'high-roller', 'odd-fellow']) diceGeometry[id] = carvedDie(undefined, id)
  resources.push(...Object.values(diceGeometry))
  return { colors, dice, dieGeometry, diceGeometry, dispose: () => resources.forEach((r) => r.dispose()) }
}
export type TavernArt = ReturnType<typeof createArt>
