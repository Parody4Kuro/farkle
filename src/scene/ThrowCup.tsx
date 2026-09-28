/* oxlint-disable react/immutability -- Frame transforms belong to Three. */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { TavernArt } from './materials'
import { cupTransform, rollElapsed } from './cupMotion'

export function ThrowCup({ art, presentation, reduced }: { art: TavernArt; presentation: RollPresentation; reduced: boolean }) {
  const refs = useRef<(Group | null)[]>([])
  useFrame(() => {
    if (presentation.playback.paused) return
    const roll = presentation.getSnapshot()
    for (const [i, player] of (['human', 'ai'] as const).entries()) {
      const group = refs.current[i]; if (!group) continue
      const transform = cupTransform(!reduced && roll?.player === player ? rollElapsed(presentation) : -1, player)
      group.position.copy(transform.position); group.quaternion.copy(transform.rotation)
    }
  })
  return <>{(['human', 'ai'] as const).map((player, i) => <group key={player} ref={(g) => { refs.current[i] = g }}>
    <mesh material={art.colors.leather} castShadow receiveShadow><cylinderGeometry args={[.049, .037, .14, 48, 1, true]} /></mesh>
    <mesh><cylinderGeometry args={[.046, .034, .133, 48, 1, true]} /><meshStandardMaterial color="#281c17" side={1} roughness={.92} /></mesh>
    <mesh position={[0, -.064, 0]} material={art.colors.woodDark}><cylinderGeometry args={[.037, .037, .012, 48]} /></mesh>
    {[-.057, .069].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={art.colors.copper}><torusGeometry args={[y > 0 ? .048 : .038, .0022, 8, 48]} /></mesh>)}
    {Array.from({ length: 12 }, (_, j) => <mesh key={j} position={[0, -.052 + j * .009, .04 + j * .0007]} rotation={[0, 0, -.4]} material={art.colors.parchment}><boxGeometry args={[.004, .001, .001]} /></mesh>)}
    <mesh position={[.028, .004, .033]} rotation={[0, .65, Math.PI / 4]} material={art.colors.copper}><boxGeometry args={[.017, .017, .0018]} /></mesh>
  </group>)}</>
}
