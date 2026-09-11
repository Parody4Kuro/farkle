import {
  CanvasTexture, DataTexture, MeshBasicMaterial, MeshToonMaterial,
  NearestFilter, RedFormat, SRGBColorSpace, BackSide,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export function createArt() {
  const gradient = new DataTexture(new Uint8Array([35, 35, 110, 110, 110, 110, 110, 255]), 8, 1, RedFormat)
  gradient.minFilter = NearestFilter
  gradient.magFilter = NearestFilter
  gradient.needsUpdate = true
  const resources: { dispose: () => void }[] = [gradient]
  const toon = (color: string) => {
    const material = new MeshToonMaterial({ color, gradientMap: gradient })
    resources.push(material)
    return material
  }
  const ink = new MeshBasicMaterial({ color: '#291c20', side: BackSide })
  resources.push(ink)
  const colors = {
    wood: toon('#a75f32'), woodLight: toon('#c58449'), woodDark: toon('#75402b'),
    copper: toon('#d9a34e'), parchment: toon('#e3c38b'), wine: toon('#754339'),
    wax: toon('#f5d29a'), dark: toon('#302b37'), green: toon('#49654f'),
  }
  const dice: Record<string, MeshToonMaterial> = {
    standard: toon('#f7e3b6'), 'lucky-one': toon('#f1c360'),
    'lucky-five': toon('#b7d2ba'), 'high-roller': toon('#aabedb'),
    'odd-fellow': toon('#d5aece'), joker: toon('#d2b9da'),
  }
  const dieGeometry = new RoundedBoxGeometry(0.94, 0.94, 0.94, 3, 0.065)
  resources.push(dieGeometry)
  const pipTextures = Array.from({ length: 7 }, (_, i) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#38252b'
    if (i < 6) {
      const v = i + 1
      const pips: [number, number][] = []
      if (v % 2) pips.push([64, 64])
      if (v >= 2) pips.push([30, 30], [98, 98])
      if (v >= 4) pips.push([98, 30], [30, 98])
      if (v === 6) pips.push([30, 64], [98, 64])
      for (const [x, y] of pips) {
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill()
      }
    } else {
      // Original geometric skull; no font glyph or downloaded artwork.
      ctx.beginPath(); ctx.ellipse(64, 53, 36, 33, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillRect(43, 70, 42, 28)
      ctx.globalCompositeOperation = 'destination-out'
      for (const x of [49, 79]) { ctx.beginPath(); ctx.ellipse(x, 52, 10, 12, 0, 0, Math.PI * 2); ctx.fill() }
      ctx.beginPath(); ctx.moveTo(64, 63); ctx.lineTo(58, 74); ctx.lineTo(70, 74); ctx.fill()
      ctx.fillRect(53, 85, 5, 13); ctx.fillRect(70, 85, 5, 13)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    resources.push(texture, material)
    return material
  })
  return { colors, dice, ink, dieGeometry, pipTextures, dispose: () => resources.forEach((resource) => resource.dispose()) }
}
export type TavernArt = ReturnType<typeof createArt>
