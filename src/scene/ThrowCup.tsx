import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Vector3 } from 'three'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { TavernArt } from './materials'

export function ThrowCup({ art, presentation, reduced, hands = false, moon = false }: {
  art: TavernArt; presentation: RollPresentation; reduced: boolean; hands?: boolean; moon?: boolean
}) {
  const { invalidate } = useThree()
  const ref = useRef<Group>(null)
  const origin = useRef(new Vector3(-6.15, 0.61, 0.1))
  const target = useRef(new Vector3())
  const started = useRef({ id: -1, time: 0 })
  useFrame((_state, delta) => {
    if (!ref.current || presentation.playback.paused) return
    const roll = presentation.getSnapshot()
    if (roll && roll.id !== started.current.id) started.current = { id: roll.id, time: presentation.playback.now() / 1000 }
    const elapsed = presentation.playback.now() / 1000 - started.current.time
    const tossing = Boolean(roll) && (!hands || roll?.player === 'human') && !reduced && elapsed < 0.8
    const lift = tossing ? Math.sin(Math.min(1, elapsed / 0.8) * Math.PI) : 0
    target.current.set(origin.current.x + lift * 3.7, origin.current.y + lift * 2.5, origin.current.z - lift * 0.8)
    ref.current.position.lerp(target.current, reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 20))
    ref.current.rotation.z = -0.12 - lift * 1.5
    ref.current.rotation.x = -lift * 0.3
    if (tossing || ref.current.position.distanceTo(target.current) > 0.002) invalidate()
  })
  return (
    <group ref={ref} position={[-6.15, 0.61, 0.1]}>
      <mesh material={moon ? art.colors.dark : art.colors.wine} castShadow>
        <cylinderGeometry args={[0.62, 0.44, 1.25, 12, 1, true]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={art.ink} scale={1.025}>
        <cylinderGeometry args={[0.62, 0.44, 1.25, 12, 1, true]} />
      </mesh>
      <mesh position={[0, -0.55, 0]} material={art.colors.woodDark}><cylinderGeometry args={[0.44, 0.44, 0.12, 12]} /></mesh>
      {[-0.46, 0.57].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={art.colors.copper}>
          <torusGeometry args={[y > 0 ? 0.61 : 0.465, 0.06, 6, 12]} />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0.555]} rotation={[0, 0, Math.PI / 4]} material={art.colors.copper}>
        <boxGeometry args={[0.25, 0.25, 0.035]} />
      </mesh>
      {hands && <group position={[-0.35, -0.2, 0.45]}>
        <mesh position={[-0.2, 0, 0.2]} scale={[0.32, 0.37, 0.2]} castShadow><sphereGeometry args={[1, 10, 8]} /><meshToonMaterial color="#c69a78" /></mesh>
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[0.12, 0.32 - i * 0.17, 0.05]} rotation={[0, 0.3, 0]} scale={[0.3, 0.075, 0.085]} castShadow>
          <sphereGeometry args={[1, 8, 8]} /><meshToonMaterial color="#c69a78" />
        </mesh>)}
        <mesh position={[-0.45, -0.3, 0.8]} rotation={[-0.5, 0.1, 0.35]} castShadow><cylinderGeometry args={[0.28, 0.42, 1.7, 10]} /><meshToonMaterial color="#485a50" /></mesh>
      </group>}
    </group>
  )
}
