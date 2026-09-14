import { isGameHidden, onGameVisibilityChange } from '../platform/visibility'
/* oxlint-disable react/immutability -- Three.js objects and frame buffers intentionally mutate outside React rendering. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Group, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { getDieDefinition } from '../game/dice'
import { JOKER, type DieFace, type DieInstance } from '../game/types'
import { FACE_NORMALS, composeRotation, faceOffset } from './physics/faces'
import { PhysicsClient } from './physics/PhysicsClient'
import type { Pose, Quat } from './physics/types'
import { createArt, type TavernArt } from './materials'
import { TavernProps } from './TavernProps'
import { ThrowCup } from './ThrowCup'
import { TavernCharacter, TavernRoom } from './TavernCharacter'
import { cameraPreset } from './camera'
import type { SceneProps } from './sceneTypes'
import { useReducedMotion } from './useReducedMotion'
import type { GamePlayback } from '../presentation/GamePlayback'

import { settleMotion, type Motion } from './motion'

interface SceneDie { die: DieInstance; locked: boolean; index: number }
type HitElements = Map<string, HTMLElement>
const identity: Quat = [0, 0, 0, 1]
const previewYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.28)
const facePlanes = Object.entries(FACE_NORMALS).map(([value, normal]) => ({
  value: Number(value) as DieFace,
  position: normal.map((v) => v * 0.471) as [number, number, number],
  rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...normal)),
}))

function DieModel({ entry, art, motion, hits, reduced, playback }: {
  entry: SceneDie; art: TavernArt; motion: Motion; hits: HitElements; reduced: boolean; playback: GamePlayback
}) {
  const ref = useRef<Group>(null)
  const { camera, size, invalidate } = useThree()
  const definition = getDieDefinition(entry.die.definitionId)
  const lastValue = useRef(entry.die.value)
  const initial = useRef(true)
  const wasPlaying = useRef(false)
  const targetPosition = useMemo(() => new Vector3(), [])
  const projection = useMemo(() => new Vector3(), [])
  const projectedEdge = useMemo(() => new Vector3(), [])
  const targetRotation = useMemo(() => new Quaternion(), [])
  const displayedRotation = useMemo(() => new Quaternion(), [])
  const halo = useRef<Group>(null)
  const id = entry.die.id

  useFrame((_state, delta) => {
    const group = ref.current
    if (!group || playback.paused) return
    let pose = motion.poses.get(id)
    if (lastValue.current !== entry.die.value && pose) {
      pose = { ...pose, rotation: composeRotation(pose.rotation, faceOffset(pose.rotation, entry.die.value, definition.jokerFace)) }
      motion.poses.set(id, pose)
      lastValue.current = entry.die.value
    }
    const selected = entry.die.selected && !entry.locked
    if (entry.locked) {
      targetPosition.set((entry.index - 3) * 1.05, 0.42, 3.65)
      targetRotation.fromArray(faceOffset(identity, entry.die.value, definition.jokerFace))
    } else if (pose) {
      targetPosition.fromArray(pose.position)
      targetPosition.y += selected ? 0.22 : 0
      targetRotation.fromArray(pose.rotation)
    } else {
      targetPosition.set((entry.index - 2.5) * 1.4, 0.49, 0)
      targetRotation.fromArray(faceOffset(identity, entry.die.value, definition.jokerFace)).premultiply(previewYaw)
    }
    const playing = motion.plan?.dice.some((die) => die.id === id)
    const ease = initial.current || reduced || playing || wasPlaying.current ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 16)
    wasPlaying.current = Boolean(playing)
    group.position.lerp(targetPosition, ease)
    displayedRotation.copy(group.quaternion).slerp(targetRotation, ease)
    group.quaternion.copy(displayedRotation)
    if (group.position.distanceTo(targetPosition) > 0.002 || group.quaternion.angleTo(targetRotation) > 0.002) invalidate()
    group.scale.setScalar(entry.locked ? 0.66 : 1)
    group.visible = !playing || reduced || (motion.plan?.start !== undefined && playback.now() / 1000 - motion.plan.start >= 0.3)
    initial.current = false
    const hit = hits.get(id)
    if (hit) {
      projection.copy(group.position).project(camera)
      hit.style.left = ((projection.x + 1) * size.width / 2) + 'px'
      hit.style.top = ((1 - projection.y) * size.height / 2) + 'px'
      projectedEdge.copy(group.position)
      projectedEdge.x += entry.locked ? 0.36 : 0.57
      projectedEdge.project(camera)
      hit.style.setProperty('--hit-size', Math.max(42, Math.abs(projectedEdge.x - projection.x) * size.width) + 'px')
      hit.style.visibility = Math.abs(projection.x) > 1.02 || Math.abs(projection.y) > 1.02 ? 'hidden' : 'visible'
    }
    if (halo.current) {
      halo.current.position.set(group.position.x, 0.035, group.position.z)
      halo.current.visible = selected
    }
  })

  return (
    <>
      <group ref={ref}>
        <mesh geometry={art.dieGeometry} material={art.dice[entry.die.definitionId] ?? art.dice.standard} castShadow receiveShadow />
        <mesh geometry={art.dieGeometry} material={art.ink} scale={1.035} />
        {facePlanes.map((face) => (
          <mesh key={face.value} position={face.position} quaternion={face.rotation} material={art.pipTextures[definition.jokerFace === face.value ? 6 : face.value - 1]}>
            <planeGeometry args={[0.7, 0.7]} />
          </mesh>
        ))}
        {entry.die.definitionId !== 'standard' && <mesh position={[0, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]} material={art.colors.copper}><ringGeometry args={[0.31, 0.345, 20]} /></mesh>}
      </group>
      <group ref={halo} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.63, 0.69, 40]} /><meshBasicMaterial color="#ffd378" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}

function SceneWorld({ entries, motion, hits, presentation, reduced, onUnavailable, opponent, view = 'table', state, appearance }: {
  entries: SceneDie[]; motion: Motion; hits: HitElements; reduced: boolean
  presentation: SceneProps['presentation']; onUnavailable: () => void
  opponent?: SceneProps['opponent']; view?: SceneProps['view']; state: SceneProps['state']; appearance?: SceneProps['appearance']
}) {
  const { camera, size, gl, invalidate, setFrameloop } = useThree()
  const [art] = useState(createArt)
  const [visible, setVisible] = useState(!isGameHidden())
  const playback = presentation.playback
  const { paused } = useSyncExternalStore(playback.subscribe, playback.getSnapshot, playback.getSnapshot)
  const bodyRotation = useMemo(() => new Quaternion(), [])
  const nextRotation = useMemo(() => new Quaternion(), [])
  const point = useMemo(() => new Vector3(), [])
  const nextPoint = useMemo(() => new Vector3(), [])
  const cameraAim = useRef(new Vector3(0, 1.65, -1.8))
  const desiredCamera = useMemo(() => cameraPreset(view, size.width / Math.max(1, size.height)), [view, size.width, size.height])
  const eye = useMemo(() => new Vector3(...desiredCamera.position), [desiredCamera])
  const aim = useMemo(() => new Vector3(...desiredCamera.target), [desiredCamera])
  useEffect(() => {
    if (opponent) {
      const perspective = camera as PerspectiveCamera
      perspective.aspect = size.width / Math.max(1, size.height)
      perspective.fov = desiredCamera.fov
      perspective.updateProjectionMatrix()
      invalidate()
      return
    }
    const orthographic = camera as OrthographicCamera
    const aspect = size.width / Math.max(1, size.height)
    const height = Math.max(8.6, 16.8 / aspect)
    orthographic.left = -height * aspect / 2
    orthographic.right = height * aspect / 2
    orthographic.top = height / 2
    orthographic.bottom = -height / 2
    orthographic.position.set(0, 13, 13)
    orthographic.lookAt(0, 0, 0)
    orthographic.updateProjectionMatrix()
    invalidate()
  }, [camera, size, invalidate, opponent, desiredCamera])

  useFrame((_state, delta) => {
    if (!opponent || playback.paused) return
    const ease = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 8)
    camera.position.lerp(eye, ease)
    cameraAim.current.lerp(aim, ease)
    camera.lookAt(cameraAim.current)
    if (camera.position.distanceTo(eye) > 0.002 || cameraAim.current.distanceTo(aim) > 0.002) invalidate()
  }, -3)

  useEffect(() => {
    presentation.setReady(true)
    const lost = (event: Event) => { event.preventDefault(); onUnavailable() }
    const visibility = () => {
      setVisible(!isGameHidden())
    }
    gl.domElement.addEventListener('webglcontextlost', lost)
    const stopVisibility = onGameVisibilityChange(visibility)
    return () => {
      presentation.setReady(false)
      gl.domElement.removeEventListener('webglcontextlost', lost)
      stopVisibility()
    }
  }, [gl, onUnavailable, presentation])
  useEffect(() => {
    setFrameloop(visible && !paused ? 'demand' : 'never')
    if (visible && !paused) invalidate()
  }, [visible, paused, setFrameloop, invalidate])
  useEffect(() => () => art.dispose(), [art])

  useFrame(() => {
    const plan = motion.plan
    if (!plan || playback.paused) return
    invalidate()
    if (plan.start < 0) plan.start = playback.now() / 1000
    const trajectory = plan.trajectory
    const duration = (trajectory.frames.length - 1) * trajectory.step
    const speed = presentation.getSnapshot()?.fast ? 2.8 : 1
    const elapsed = reduced ? duration : Math.max(0, Math.min(duration, (playback.now() / 1000 - plan.start - 0.3) * speed))
    const frame = Math.min(trajectory.frames.length - 1, Math.floor(elapsed / trajectory.step))
    const next = Math.min(trajectory.frames.length - 1, frame + 1)
    const alpha = Math.min(1, elapsed / trajectory.step - frame)
    for (let i = 0; i < plan.dice.length; i++) {
      const a = trajectory.frames[frame][i], b = trajectory.frames[next][i]
      point.fromArray(a.position).lerp(nextPoint.fromArray(b.position), alpha)
      bodyRotation.fromArray(a.rotation).slerp(nextRotation.fromArray(b.rotation), alpha)
      motion.poses.set(plan.dice[i].id, {
        position: point.toArray() as Pose['position'],
        rotation: composeRotation(bodyRotation.toArray() as Quat, plan.offsets[i]),
      })
    }
    const current = presentation.getSnapshot()
    while (plan.impact < trajectory.impacts.length && trajectory.impacts[plan.impact].time <= elapsed) {
      if (!reduced && current?.id === plan.id) current.onImpact(trajectory.impacts[plan.impact].strength)
      plan.impact++
    }
    if (elapsed >= duration) {
      motion.plan = undefined
      // Commit outside the frame loop, after all meshes can see the final pose.
      queueMicrotask(() => presentation.finish(plan.id))
    }
  }, -2)

  return (
    <>
      <color attach="background" args={[opponent ? '#201f21' : '#29222a']} />
      <ambientLight intensity={0.55} color="#b8b0cc" />
      <directionalLight position={[-3, 10, 5]} color="#ffdda1" intensity={1.8} castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9}
        shadow-camera-top={8} shadow-camera-bottom={-8} shadow-normalBias={0.04} />
      <TavernProps art={art} />
      {opponent && <><TavernRoom moon={appearance === 'moon'} /><TavernCharacter key={opponent.id} opponent={opponent} state={state} reduced={reduced} playback={playback} /></>}
      <ThrowCup art={art} presentation={presentation} reduced={reduced} hands={Boolean(opponent)} moon={appearance === 'moon'} />
      {entries.map((entry) => <DieModel key={entry.die.id} entry={entry} art={art} motion={motion} hits={hits} reduced={reduced} playback={playback} />)}
    </>
  )
}

export default function TavernScene({ state, presentation, selectionValid, onToggleDie, onUnavailable, opponent, view, appearance }: SceneProps) {
  const playback = presentation.playback
  const { paused } = useSyncExternalStore(playback.subscribe, playback.getSnapshot, playback.getSnapshot)
  const request = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, () => null)
  const reduced = useReducedMotion()
  const [preparedId, setPreparedId] = useState<number | null>(null)
  const [motion] = useState<Motion>(() => ({ poses: new Map() }))
  const [hits] = useState<HitElements>(() => new Map())
  const client = useRef<PhysicsClient | null>(null)
  useEffect(() => {
    const physics = new PhysicsClient()
    client.current = physics
    physics.warm()
    return () => { physics.dispose(); client.current = null }
  }, [])
  useEffect(() => {
    if (!request) { settleMotion(motion); return }
    const controller = new AbortController()
    void client.current?.prepare(request.dice.length, controller.signal).then((trajectory) => {
      if (!trajectory || controller.signal.aborted || presentation.getSnapshot()?.id !== request.id) return
      playback.whenRunning(() => {
        if (controller.signal.aborted || presentation.getSnapshot()?.id !== request.id) return
        const final = trajectory.frames.at(-1)!
        const offsets = request.dice.map((die, i) => faceOffset(final[i].rotation, die.value, getDieDefinition(die.definitionId).jokerFace))
        request.dice.forEach((die, i) => {
          motion.poses.set(die.id, { position: trajectory.frames[0][i].position, rotation: composeRotation(trajectory.frames[0][i].rotation, offsets[i]) })
        })
        motion.plan = { trajectory, dice: request.dice, offsets, id: request.id, start: -1, impact: 0 }
        setPreparedId(request.id)
      }, controller.signal)
    }).catch(() => presentation.finish(request.id))
    return () => { controller.abort(); settleMotion(motion, request.id) }
  }, [request, motion, presentation, playback])

  const readyDice: DieInstance[] = Array.from({ length: state.diceToRoll }, (_, i) => ({
    id: 'ready-' + i, definitionId: state.config.dieLoadout[i] ?? 'standard',
    value: (i % 6 + 1) as DieFace, selected: false,
  }))
  const rollingDice = request && preparedId === request.id ? request.dice : []
  const visibleDice = state.rolledDice.length ? state.rolledDice : request ? rollingDice : state.phase === 'ready' ? readyDice : []
  const locked = state.lockedDice.slice(-7)
  const entries: SceneDie[] = [
    ...visibleDice.map((die, index) => ({ die, index, locked: false })),
    ...locked.map((die, index) => ({ die, index: index + (7 - locked.length) / 2, locked: true })),
  ]
  useEffect(() => {
    // The presenter completes before the hook commits ROLL_RESOLVED. Keep its final poses across that gap.
    if (!state.rolledDice.length && state.phase !== 'ready' && state.phase !== 'game_over') return
    const ids = new Set([...state.rolledDice, ...state.lockedDice.slice(-7), ...(request?.dice ?? [])].map((die) => die.id))
    for (const id of motion.poses.keys()) if (!ids.has(id)) motion.poses.delete(id)
  }, [state.rolledDice, state.lockedDice, state.phase, request, motion])

  return (
    <div className="tavern-scene">
      <div className="scene-canvas" aria-hidden="true">
        <Canvas frameloop="demand" orthographic={!opponent} camera={{ position: opponent ? [0, 4.7, 11.8] : [0, 13, 13], near: 0.1, far: 70, fov: 50 }} dpr={[1, 1.5]} shadows="percentage" gl={{ antialias: true, alpha: false }} fallback={null}>
          <SceneWorld entries={entries} motion={motion} hits={hits} presentation={presentation} reduced={reduced} onUnavailable={onUnavailable}
            opponent={opponent} view={view} state={state} appearance={appearance} />
        </Canvas>
      </div>
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-hit-layer" role="group" aria-label="桌面上的骰子">
        {entries.map(({ die, index, locked: isLocked }) => {
          const interactive = !paused && !isLocked && state.currentPlayer === 'human' && state.phase === 'selecting' && !state.doubledSelection && (!opponent || view !== 'opponent')
          const definition = getDieDefinition(die.definitionId)
          const label = (die.value === JOKER ? 'Joker 骰，显示骷髅面' : '骰子点数 ' + die.value) + '，' + definition.name + (isLocked ? '，已锁定' : die.selected ? '，已选择' : '')
          const className = 'dice-hit' + (die.selected ? ' selected' : '') + (isLocked ? ' locked' : '') + (die.selected && !selectionValid ? ' invalid' : '')
          if (interactive) return (
            <button key={die.id} data-die-id={die.id} type="button" className={className} aria-label={label} aria-pressed={die.selected}
              ref={(el) => { if (el) hits.set(die.id, el); else hits.delete(die.id) }} onClick={() => onToggleDie(die.id)}>
              <span aria-hidden="true">{String(index + 1)}{die.selected ? ' ✓' : ''}</span>
            </button>
          )
          return <span key={die.id} className={className + ' noninteractive'} role="img" aria-label={state.phase === 'rolling' && !isLocked ? '骰子正在滚动' : label}
            ref={(el) => { if (el) hits.set(die.id, el); else hits.delete(die.id) }} />
        })}
      </div>
      <div className="scene-tray-label"><span>计分托盘</span><span>{state.lockedDice.length ? state.lockedDice.length + ' 颗已锁定' : '留住好运，再掷一把'}</span></div>
      {state.lockedDice.length > 7 && <details className="tray-history"><summary>另有 {state.lockedDice.length - 7} 颗 · 查看记录</summary><p>{state.lockedDice.map((die) => die.value === JOKER ? '骷髅' : die.value).join(' · ')}</p></details>}
    </div>
  )
}
