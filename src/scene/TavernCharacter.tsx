/* oxlint-disable react/immutability -- Frame-local transforms are Three.js state. */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { OpponentDefinition } from '../game/opponents'
import type { GameState } from '../game/types'
import type { GamePlayback } from '../presentation/GamePlayback'

function Form({ position, scale, color, rotation = [0, 0, 0], shape = 'sphere' }: {
  position: [number, number, number]; scale: [number, number, number]; color: string
  rotation?: [number, number, number]; shape?: 'sphere' | 'box'
}) {
  return <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
    {shape === 'sphere' ? <sphereGeometry args={[1, 12, 10]} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshToonMaterial color={color} />
  </mesh>
}

/** Original modular half-body characters, built entirely from local geometry. */
export function TavernCharacter({ opponent: o, state, reduced, playback }: { opponent: OpponentDefinition; state: GameState; reduced: boolean; playback: GamePlayback }) {
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const arm = useRef<Group>(null)
  const eyes = useRef<Group>(null)
  const settling = useRef(0)
  useFrame(({ invalidate }, frameDelta) => {
    if (playback.paused) return
    const delta = Math.min(frameDelta, 0.05)
    const ai = state.currentPlayer === 'ai'
    const bust = state.phase === 'bust'
    const lean = ai && o.difficulty === 'aggressive' ? 0.12 : bust ? -0.12 : 0
    if (body.current) {
      body.current.rotation.x += (lean - body.current.rotation.x) * (reduced ? 1 : Math.min(1, delta * 5))
      if (Math.abs(body.current.rotation.x - lean) > 0.001) invalidate()
    }
    if (head.current) head.current.rotation.z = bust ? (o.id === 'rue' ? -0.18 : 0.12) : 0
    if (arm.current) {
      const gesture = ai && ['rolling', 'ai_thinking'].includes(state.phase)
      const target = gesture && !reduced ? Math.sin(playback.now() / 1000 * (o.id === 'mara' ? 4 : 2)) * 0.11 : 0
      arm.current.rotation.z += (target - arm.current.rotation.z) * (reduced ? 1 : Math.min(1, delta * 9))
      if (gesture && !reduced) invalidate()
    }
    // Brief, bounded breathing/eye gesture on a new event; idle tables return to demand rendering.
    if (eyes.current) eyes.current.scale.y = bust ? 0.4 : 1
    settling.current += delta
  })
  const woman = o.id === 'mara' || o.id === 'rue'
  return <group position={[0, 0, -4.25]} ref={body}>
    <Form position={[0, 1.25, -0.08]} scale={[1.25, 1.55, 0.66]} color={o.color} />
    <Form position={[0, 1.18, 0.58]} scale={[1.13, 1.6, 0.07]} color={o.id === 'keeper' ? '#b6a080' : '#bda78b'} shape="box" />
    {[-1, 1].map((s) => <group key={s}>
      <Form position={[s * 0.67, 1.9, 0.58]} scale={[0.48, 1.24, 0.11]} rotation={[0, 0, s * -0.25]} color={o.color} shape="box" />
      <Form position={[s * 1.13, 1.18, 0.06]} scale={[0.48, 0.82, 0.49]} rotation={[0, 0, s * 0.35]} color={o.color} />
    </group>)}
    {[0.65, 1.05, 1.45].map((y) => <Form key={y} position={[0, y, 0.68]} scale={[0.065, 0.065, 0.04]} color="#d0a76a" />)}
    <Form position={[0, 2.4, 0]} scale={[0.32, 0.5, 0.32]} color={o.skin} />
    <group ref={head} position={[0, 3.13, 0.08]}>
      <Form position={[0, 0.1, -0.13]} scale={[0.7, 0.87, 0.62]} color={o.beard} />
      <Form position={[0, 0, 0.11]} scale={[0.58, 0.76, 0.51]} color={o.skin} />
      {[-1, 1].map((s) => <Form key={s} position={[s * 0.58, -0.01, 0.1]} scale={[0.13, 0.23, 0.16]} color={o.skin} />)}
      <Form position={[0, 0.025, 0.64]} scale={[0.13, 0.22, 0.2]} color={o.skin} />
      <group ref={eyes}>
        {[-1, 1].map((s) => <group key={s}>
          <Form position={[s * 0.24, 0.18, 0.55]} scale={[0.14, 0.083, 0.06]} color="#f1dfbc" />
          <Form position={[s * 0.24, 0.175, 0.603]} scale={[0.052, 0.058, 0.03]} color="#222020" />
          <Form position={[s * 0.23, 0.33, 0.55]} scale={[0.28, 0.055, 0.08]} rotation={[0, 0, s * -0.1]} color={o.beard} shape="box" />
        </group>)}
      </group>
      <Form position={[0, -0.31, 0.55]} scale={[0.2, 0.03, 0.055]} color="#6e4134" />
      {!woman && <>
        <Form position={[0, -0.53, 0.27]} scale={[0.46, 0.41, 0.43]} color={o.beard} />
        {[-1, 1].map((s) => <Form key={s} position={[s * 0.19, -0.19, 0.59]} scale={[0.22, 0.1, 0.095]} rotation={[0, 0, s * 0.12]} color={o.beard} />)}
      </>}
      {o.id === 'mara' && <>
        <Form position={[0, 0.71, -0.16]} scale={[0.64, 0.3, 0.59]} color="#b4b29a" />
        <Form position={[0.52, 0.37, -0.05]} scale={[0.2, 0.5, 0.3]} color="#b4b29a" />
        <Form position={[-0.59, -0.15, 0.2]} scale={[0.055, 0.12, 0.06]} color="#e5b763" />
      </>}
      {o.id === 'rue' && <>
        <Form position={[0.08, 0.65, 0.01]} scale={[0.76, 0.35, 0.64]} rotation={[0, 0, -0.16]} color="#653a55" />
        <Form position={[0.16, 0.56, 0.41]} scale={[0.87, 0.055, 0.39]} rotation={[0, 0, -0.16]} color="#463045" />
        <Form position={[0.63, 0.95, 0.03]} scale={[0.065, 0.5, 0.12]} rotation={[0, 0, -0.4]} color="#c4a77d" />
      </>}
    </group>
    <group ref={arm} position={[-1.12, 0.85, 0.1]}>
      <Form position={[-0.27, -0.45, 0.7]} scale={[0.38, 0.32, 0.85]} rotation={[-0.23, -0.2, 0]} color={o.color} />
      <Form position={[-0.2, -0.52, 1.35]} scale={[0.3, 0.17, 0.38]} color={o.skin} />
      {[0, 1, 2, 3].map((i) => <Form key={i} position={[-0.44 + i * 0.14, -0.5, 1.57]} scale={[0.06, 0.08, 0.26]} color={o.skin} />)}
      {state.currentPlayer === 'ai' && state.phase === 'rolling' && <mesh position={[-0.2, -0.04, 1.45]} rotation={[0.15, 0, -0.3]} castShadow>
        <cylinderGeometry args={[0.42, 0.32, 0.85, 12, 1, true]} /><meshToonMaterial color={o.color} />
      </mesh>}
    </group>
    <Form position={[1.23, 0.31, 0.92]} scale={[0.37, 0.3, 0.83]} rotation={[-0.17, 0.3, 0]} color={o.color} />
    <Form position={[1.02, 0.32, 1.5]} scale={[0.33, 0.18, 0.38]} color={o.skin} />
    {o.id === 'osric' && <Form position={[0.84, 1.75, 0.61]} scale={[0.15, 0.22, 0.08]} color="#d0b678" shape="box" />}
  </group>
}

export function TavernRoom({ moon = false }: { moon?: boolean }) {
  return <group>
    <Form position={[0, 2.2, -9.5]} scale={[32, 12, 0.4]} color="#282525" shape="box" />
    {[-12, -7, 0, 7, 12].map((x) => <Form key={x} position={[x, 2, -9.1]} scale={[0.28, 12, 0.45]} color="#4b3327" shape="box" />)}
    {[1, 5].map((y) => <Form key={y} position={[0, y, -9]} scale={[32, 0.26, 0.45]} color="#4b3327" shape="box" />)}
    <group position={[-7, 2.4, -8.85]}>
      <Form position={[0, 0, 0]} scale={[3.4, 4.2, 0.12]} color={moon ? '#486275' : '#344551'} shape="box" />
      <Form position={[0, 0, 0.15]} scale={[0.12, 4.2, 0.18]} color="#211e20" shape="box" />
      <Form position={[0, 0.2, 0.15]} scale={[3.4, 0.12, 0.18]} color="#211e20" shape="box" />
      <mesh position={[0.85, 1.1, 0.1]}><circleGeometry args={[0.4, 24]} /><meshBasicMaterial color="#e0d8b2" /></mesh>
    </group>
    <group position={[7.6, 0.6, -8.5]}>
      <Form position={[0, 0, 0]} scale={[4.6, 4.1, 1]} color="#45403a" shape="box" />
      <Form position={[0, -0.45, 0.55]} scale={[3.1, 2.6, 0.08]} color="#171619" shape="box" />
      {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[-0.9 + i * 0.43, -1.05 + i % 2 * 0.18, 0.65]} scale={[0.23, 0.5 + i % 3 * 0.1, 0.22]}>
        <sphereGeometry args={[1, 7, 7]} /><meshBasicMaterial color={i % 2 ? '#eea34c' : '#bc6435'} />
      </mesh>)}
      <pointLight position={[0, 0, 1.5]} color="#ffb365" intensity={20} distance={14} decay={2} />
    </group>
    <Form position={[0, -1, -7]} scale={[32, 0.2, 20]} color="#241d1c" shape="box" />
  </group>
}
