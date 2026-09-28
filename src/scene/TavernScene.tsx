/* oxlint-disable react/immutability -- Three objects and frame buffers intentionally mutate outside React rendering. */
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EquirectangularReflectionMapping, Group, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { getDieDefinition } from '../game/dice'
import { JOKER, type DieFace, type DieInstance } from '../game/types'
import { composeRotation, faceOffset } from './physics/faces'
import { PhysicsClient } from './physics/PhysicsClient'
import type { Pose, Quat } from './physics/types'
import { createArt, type TavernArt } from './materials'
import { TavernProps } from './TavernProps'
import { ThrowCup } from './ThrowCup'
import { rollElapsed } from './cupMotion'
import { RiggedPerson, TavernRoom } from './TavernCharacter'
import { cameraPreset, type CameraShot } from './camera'
import type { SceneProps } from './sceneTypes'
import { settleMotion, type Motion } from './motion'
import { TABLE, trayPosition, ROLL_RELEASE, rollSpeed } from './layout'
import { usePresentationAction } from '../hooks/usePresentation'
import { actionProgress, smooth, type ActionFrame } from '../presentation/ActionPlayback'
import { isGameHidden, onGameVisibilityChange } from '../platform/visibility'

interface SceneDie { die: DieInstance; locked: boolean; index: number }
type HitElements = Map<string, HTMLElement>
const identity: Quat = [0, 0, 0, 1]
const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -.2)

function DieModel({ entry, art, motion, hits, presentation, action, reduced, player }: {
  entry: SceneDie; art: TavernArt; motion: Motion; hits: HitElements; presentation: SceneProps['presentation']; action: ActionFrame | null; reduced: boolean; player: SceneProps['state']['currentPlayer']
}) {
  const ref = useRef<Group>(null), halo = useRef<Group>(null)
  const { camera, size, invalidate } = useThree()
  const definition = getDieDefinition(entry.die.definitionId), id = entry.die.id, playback = presentation.playback
  const lastValue = useRef(entry.die.value), initial = useRef(true), wasPlaying = useRef(false)
  const objects = useMemo(() => ({ position: new Vector3(), projected: new Vector3(), edge: new Vector3(), rotation: new Quaternion(), end: new Quaternion(), tray: new Vector3() }), [])
  useFrame((_state, delta) => {
    const group = ref.current
    if (!group || playback.paused) return
    let pose = motion.poses.get(id)
    if (lastValue.current !== entry.die.value && pose) {
      pose = { ...pose, rotation: composeRotation(pose.rotation, faceOffset(pose.rotation, entry.die.value, definition.jokerFace)) }
      motion.poses.set(id, pose); lastValue.current = entry.die.value
    }
    const selected = entry.die.selected && !entry.locked
    const { position, rotation, projected, edge, tray, end } = objects
    if (entry.locked) {
      position.fromArray(trayPosition(entry.index, player)); rotation.fromArray(faceOffset(identity, entry.die.value, definition.jokerFace))
    } else if (pose) {
      position.fromArray(pose.position); rotation.fromArray(pose.rotation)
      position.y += selected ? .006 : 0
      if (selected) rotation.premultiply(yaw)
    } else {
      position.set((entry.index - 2.5) * .052, TABLE.die / 2, .018)
      rotation.fromArray(faceOffset(identity, entry.die.value, definition.jokerFace)).premultiply(yaw)
    }
    const playingIndex = motion.plan?.dice.findIndex((d) => d.id === id) ?? -1
    const playing = playingIndex >= 0
    let visible = !playing || reduced || rollElapsed(presentation) >= ROLL_RELEASE + (motion.plan?.trajectory.releases?.[playingIndex] ?? 0)
    const progress = action ? actionProgress(action, playback.now()) : 0
    const p = reduced ? 1 : action?.kind === 'victory' ? Math.min(1, progress / .5) : progress
    if (action) {
      const take = action.diceIds.includes(id), sweep = ['bank', 'victory', 'bust'].includes(action.kind)
      if (action.kind === 'ability' && take) {
        const afterDie = action.after.rolledDice.find((d) => d.id === id)
        if (afterDie && afterDie.value !== entry.die.value) {
          end.fromArray(composeRotation(rotation.toArray() as Quat, faceOffset(rotation.toArray() as Quat, afterDie.value, definition.jokerFace)))
          rotation.slerp(end, smooth(p)); position.y += Math.sin(p * Math.PI) * .022
        } else position.y += Math.sin(p * Math.PI) * .008
      } else if (action.kind === 'collect' && !take && !entry.locked) {
        const gather = smooth((p - .64) / .32)
        tray.set(action.player === 'human' ? -.318 : .318, .143, action.player === 'human' ? .08 : -.08)
        position.lerp(tray, gather); position.y += Math.sin(gather * Math.PI) * .026; visible = p < .96
      } else if (take || sweep || action.kind === 'hot') {
        const order = Math.max(0, action.diceIds.indexOf(id)), t = smooth((p - .2 - order * .018) / .43)
        tray.fromArray(trayPosition((action.before.lockedDice.length + order) % 7, action.player))
        position.lerp(tray, t); position.y += Math.sin(t * Math.PI) * .028
        end.fromArray(faceOffset(identity, entry.die.value, definition.jokerFace)); rotation.slerp(end, t)
        if (sweep || action.kind === 'hot') { const clear = smooth((p - .7) / .25); tray.set(action.player === 'human' ? -.318 : .318, .143, action.player === 'human' ? .08 : -.08); position.lerp(tray, clear); visible = p < .95 }
      }
    }
    const ease = initial.current || reduced || playing || wasPlaying.current || action ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 30)
    group.position.lerp(position, ease); group.quaternion.slerp(rotation, ease)
    group.scale.setScalar(TABLE.die); group.visible = visible
    if (group.position.distanceTo(position) > .0001 || group.quaternion.angleTo(rotation) > .001) invalidate()
    wasPlaying.current = playing; initial.current = false
    const hit = hits.get(id)
    if (hit) {
      projected.copy(group.position).project(camera); edge.copy(group.position); edge.x += TABLE.die * .6; edge.project(camera)
      hit.style.left = `${(projected.x + 1) * size.width / 2}px`; hit.style.top = `${(1 - projected.y) * size.height / 2}px`
      hit.style.setProperty('--hit-size', `${Math.max(42, Math.abs(edge.x - projected.x) * size.width)}px`)
      hit.style.visibility = !visible || Math.abs(projected.x) > 1.02 || Math.abs(projected.y) > 1.02 ? 'hidden' : 'visible'
    }
    if (halo.current) { halo.current.position.set(group.position.x, .0008, group.position.z); halo.current.visible = selected && !action }
  })
  return <>
    <group ref={ref}>
      <mesh geometry={art.diceGeometry[entry.die.definitionId] ?? art.dieGeometry} material={art.dice[entry.die.definitionId] ?? art.dice.standard} castShadow receiveShadow />
      {entry.die.definitionId !== 'standard' && <mesh position={[0, -.494, 0]} rotation={[-Math.PI / 2, 0, 0]} material={art.colors.copper}><ringGeometry args={[.393, .415, 40]} /></mesh>}
    </group>
    <group ref={halo} visible={false}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.024, .0255, 40]} /><meshBasicMaterial color="#eac280" transparent opacity={.75} depthWrite={false} /></mesh></group>
  </>
}

function FrameQuality({ presentation }: { presentation: SceneProps['presentation'] }) {
  const { gl, setDpr } = useThree()
  const samples = useRef<number[]>([]), current = useRef(1.5)
  const preferences = useSyncExternalStore(presentation.actions.subscribe, presentation.actions.getPreferences, presentation.actions.getPreferences)
  useEffect(() => { current.current = preferences.quality === 'low' ? 1 : 1.5; setDpr(Math.min(devicePixelRatio || 1, current.current)); samples.current = [] }, [preferences.quality, setDpr])
  useFrame((_state, delta) => {
    if (presentation.playback.paused || (!presentation.getSnapshot() && !presentation.actions.busy) || delta > .1) return
    const values = samples.current; values.push(delta * 1000); if (values.length > 180) values.shift()
    if (values.length < 45 || values.length % 15 !== 0) return
    const sorted = [...values].sort((a, b) => a - b)
    gl.domElement.dataset.frameP50 = sorted[Math.floor(sorted.length * .5)].toFixed(2)
    gl.domElement.dataset.frameP95 = sorted[Math.floor(sorted.length * .95)].toFixed(2)
    gl.domElement.dataset.triangles = String(gl.info.render.triangles)
    gl.domElement.dataset.drawCalls = String(gl.info.render.calls)
    gl.domElement.dataset.renderDpr = String(gl.getPixelRatio())
    if (preferences.quality === 'auto' && current.current > 1 && sorted[Math.floor(sorted.length * .5)] > 22) {
      current.current = 1; setDpr(1)
    }
  })
  return null
}

function SceneWorld({ entries, motion, hits, presentation, action, reduced, onUnavailable, opponent, view = 'table', state, appearance }: {
  entries: SceneDie[]; motion: Motion; hits: HitElements; presentation: SceneProps['presentation']; action: ActionFrame | null; reduced: boolean
  onUnavailable: () => void; opponent?: SceneProps['opponent']; view?: SceneProps['view']; state: SceneProps['state']; appearance?: SceneProps['appearance']
}) {
  const { camera, scene, size, gl, invalidate, setFrameloop } = useThree()
  const [art] = useState(createArt), [visible, setVisible] = useState(!isGameHidden())
  const playback = presentation.playback, prefs = presentation.actions.preferences
  const { paused } = useSyncExternalStore(playback.subscribe, playback.getSnapshot, playback.getSnapshot)
  const objects = useMemo(() => ({ rotation: new Quaternion(), nextRotation: new Quaternion(), point: new Vector3(), nextPoint: new Vector3(), eye: new Vector3(), aim: new Vector3(), currentAim: new Vector3() }), [])
  const cameraInitialized = useRef(false)
  useEffect(() => {
    let dead = false
    const loader = new RGBELoader()
    let texture: Awaited<ReturnType<typeof loader.loadAsync>> | undefined
    void loader.loadAsync(`${import.meta.env.BASE_URL}art/materials/tavern-environment.hdr`).then((map) => {
      if (dead) { map.dispose(); return }
      texture = map; map.mapping = EquirectangularReflectionMapping; scene.environment = map; scene.environmentIntensity = .26; invalidate()
    }).catch(() => { /* Key/fill lighting remains playable without the optional environment. */ })
    return () => { dead = true; scene.environment = null; texture?.dispose() }
  }, [scene, invalidate])
  useEffect(() => {
    presentation.setReady(true)
    const lost = (event: Event) => { event.preventDefault(); onUnavailable() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    const stop = onGameVisibilityChange(() => setVisible(!isGameHidden()))
    return () => { presentation.setReady(false); stop(); gl.domElement.removeEventListener('webglcontextlost', lost) }
  }, [gl, onUnavailable, presentation])
  useEffect(() => {
    setFrameloop(visible && !paused ? 'demand' : 'never'); if (visible && !paused) invalidate()
  }, [visible, paused, setFrameloop, invalidate])
  useEffect(() => () => art.dispose(), [art])
  useFrame((_state, delta) => {
    if (playback.paused) return
    const request = presentation.getSnapshot(), elapsed = rollElapsed(presentation)
    const p = action ? actionProgress(action, playback.now()) : 0
    let shot: CameraShot = view
    if (!reduced && prefs.cinematic && !prefs.fast) {
      if (request) shot = elapsed >= 0 && elapsed < 1.6 ? 'cup' : 'table'
      else if (action) {
        shot = 'table'
        if (action.kind === 'bust' && p > .15 && p < .66) shot = opponent ? 'opponent' : 'hands'
        else if (action.kind === 'victory' && p > .55 && p < .92) shot = opponent ? 'opponent' : 'hands'
        else if (action.kind === 'victory' && p > .14 && p < .45) shot = 'ledger'
        else if (action.kind === 'bank' && p > .36 && p < .72) shot = 'ledger'
        else if (action.kind === 'hot' && p < .6) shot = 'hands'
      }
    } else if (request || action) shot = 'table'
    const preset = cameraPreset(shot, size.width / Math.max(1, size.height), request?.player ?? action?.player ?? 'human')
    objects.eye.fromArray(preset.position); objects.aim.fromArray(preset.target)
    if (request && shot === 'table' && prefs.cinematic && !prefs.fast && !reduced && elapsed > 1.6 && elapsed < 2.7) {
      // A small follow-through tracks the landing group, then fades completely
      // before selection; the resting camera remains the shared validated one.
      objects.point.set(0, 0, 0)
      for (const die of request.dice) {
        const pose = motion.poses.get(die.id)
        if (pose) objects.point.add(objects.nextPoint.fromArray(pose.position))
      }
      objects.point.multiplyScalar(Math.sin((elapsed - 1.6) / 1.1 * Math.PI) * .15 / request.dice.length)
      const dx = Math.max(-.025, Math.min(.025, objects.point.x)), dz = Math.max(-.012, Math.min(.012, objects.point.z))
      objects.eye.x += dx; objects.aim.x += dx; objects.eye.z += dz; objects.aim.z += dz
    }
    const stableSelection = !request && !action && state.phase === 'selecting' && view === 'table'
    const ease = !cameraInitialized.current || reduced || stableSelection ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 9)
    camera.position.lerp(objects.eye, ease); objects.currentAim.lerp(objects.aim, ease); camera.lookAt(objects.currentAim)
    const perspective = camera as PerspectiveCamera
    perspective.aspect = size.width / Math.max(1, size.height); perspective.fov += (preset.fov - perspective.fov) * ease; perspective.updateProjectionMatrix()
    // DOM hit targets project later in this frame, before WebGLRenderer updates
    // camera matrices. A final camera snap must not leave stale click locations.
    camera.updateMatrixWorld(true)
    cameraInitialized.current = true
    if (request || action || camera.position.distanceTo(objects.eye) > .0001 || objects.currentAim.distanceTo(objects.aim) > .0001) invalidate()
  }, -3)
  useFrame(() => {
    const plan = motion.plan
    if (!plan || playback.paused) return
    invalidate()
    if (plan.start < 0) { plan.start = playback.now() / 1000; presentation.start(plan.id) }
    const trajectory = plan.trajectory, duration = (trajectory.frames.length - 1) * trajectory.step
    const speed = rollSpeed(presentation.getSnapshot()?.fast)
    const elapsed = reduced ? duration : Math.max(0, Math.min(duration, (playback.now() / 1000 - plan.start) * speed - ROLL_RELEASE))
    const frame = Math.min(trajectory.frames.length - 1, Math.floor(elapsed / trajectory.step)), next = Math.min(trajectory.frames.length - 1, frame + 1), alpha = Math.min(1, elapsed / trajectory.step - frame)
    for (let i = 0; i < plan.dice.length; i++) {
      const a = trajectory.frames[frame][i], b = trajectory.frames[next][i]
      objects.point.fromArray(a.position).lerp(objects.nextPoint.fromArray(b.position), alpha)
      objects.rotation.fromArray(a.rotation).slerp(objects.nextRotation.fromArray(b.rotation), alpha)
      motion.poses.set(plan.dice[i].id, { position: objects.point.toArray() as Pose['position'], rotation: composeRotation(objects.rotation.toArray() as Quat, plan.offsets[i]) })
    }
    const current = presentation.getSnapshot()
    while (plan.impact < trajectory.impacts.length && trajectory.impacts[plan.impact].time <= elapsed) {
      if (!reduced && current?.id === plan.id) current.onImpact(trajectory.impacts[plan.impact].strength)
      plan.impact++
    }
    if (elapsed >= duration) { motion.plan = undefined; queueMicrotask(() => presentation.finish(plan.id)) }
  }, -2)
  return <>
    <color attach="background" args={['#221b14']} /><fog attach="fog" args={['#221b14', 2, 6]} />
    <ambientLight intensity={.42} color="#b4bdc7" />
    <hemisphereLight intensity={.45} color="#d6deeb" groundColor="#594333" />
    <directionalLight position={[-.6, 1.4, .7]} color="#ffe6c0" intensity={2.5} castShadow shadow-mapSize={prefs.quality === 'low' ? [1024, 1024] : [2048, 2048]} shadow-camera-left={-.85} shadow-camera-right={.85} shadow-camera-top={1} shadow-camera-bottom={-.7} shadow-camera-near={.1} shadow-camera-far={4} shadow-normalBias={.0005} shadow-bias={-.00007} />
    <directionalLight position={[.8, .8, -1]} color="#becfe3" intensity={1.1} />
    <FrameQuality presentation={presentation} /><TavernProps art={art} /><TavernRoom moon={appearance === 'moon'} />
    <Suspense fallback={null}>
      <RiggedPerson asset={opponent?.id ?? 'player-hands'} player="ai" presentation={presentation} motion={motion} reduced={reduced} handsOnly={!opponent} />
      <RiggedPerson asset="player-hands" player="human" presentation={presentation} motion={motion} reduced={reduced} handsOnly />
    </Suspense>
    <ThrowCup art={art} presentation={presentation} reduced={reduced} />
    {entries.map((entry) => <DieModel key={entry.die.id} entry={entry} art={art} motion={motion} hits={hits} presentation={presentation} action={action} reduced={reduced} player={state.currentPlayer} />)}
  </>
}

export default function TavernScene({ state: actual, presentation, selectionValid, onToggleDie, onUnavailable, opponent, view, appearance }: SceneProps) {
  const playback = presentation.playback
  const { paused } = useSyncExternalStore(playback.subscribe, playback.getSnapshot, playback.getSnapshot)
  const request = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, () => null)
  const action = usePresentationAction(presentation)
  const preferences = useSyncExternalStore(presentation.actions.subscribe, presentation.actions.getPreferences, presentation.actions.getPreferences)
  const reduced = preferences.reducedMotion
  const state = action?.before ?? actual
  const [preparedId, setPreparedId] = useState<number | null>(null), [motion] = useState<Motion>(() => ({ poses: new Map() })), [hits] = useState<HitElements>(() => new Map())
  const client = useRef<PhysicsClient | null>(null)
  useEffect(() => { const physics = new PhysicsClient(); client.current = physics; physics.warm(); return () => { physics.dispose(); client.current = null } }, [])
  useEffect(() => {
    if (!request) { settleMotion(motion); return }
    const controller = new AbortController()
    void client.current?.prepare(request.dice.length, controller.signal, request.player).then((trajectory) => {
      if (!trajectory || controller.signal.aborted || presentation.getSnapshot()?.id !== request.id) return
      playback.whenRunning(() => {
        if (controller.signal.aborted || presentation.getSnapshot()?.id !== request.id) return
        const final = trajectory.frames.at(-1)!, offsets = request.dice.map((die, i) => faceOffset(final[i].rotation, die.value, getDieDefinition(die.definitionId).jokerFace))
        request.dice.forEach((die, i) => motion.poses.set(die.id, { position: trajectory.frames[0][i].position, rotation: composeRotation(trajectory.frames[0][i].rotation, offsets[i]) }))
        motion.plan = { trajectory, dice: request.dice, offsets, id: request.id, start: -1, impact: 0 }; setPreparedId(request.id)
      }, controller.signal)
    }).catch(() => presentation.finish(request.id))
    return () => { controller.abort(); settleMotion(motion, request.id) }
  }, [request, motion, presentation, playback])
  const readyDice: DieInstance[] = Array.from({ length: state.diceToRoll }, (_, i) => ({ id: 'ready-' + i, definitionId: state.config.dieLoadout[i] ?? 'standard', value: (i % 6 + 1) as DieFace, selected: false }))
  const rollingDice = request && preparedId === request.id ? request.dice : []
  const visibleDice = request ? rollingDice : state.rolledDice.length ? state.rolledDice : state.phase === 'ready' && !action ? readyDice : []
  const locked = state.lockedDice.slice(-7), entries: SceneDie[] = [...visibleDice.map((die, index) => ({ die, index, locked: false })), ...locked.filter((d) => !visibleDice.some((v) => v.id === d.id)).map((die, index) => ({ die, index: index + (7 - locked.length) / 2, locked: true }))]
  useEffect(() => {
    if (action || (!state.rolledDice.length && state.phase !== 'ready' && state.phase !== 'game_over')) return
    const ids = new Set([...state.rolledDice, ...state.lockedDice.slice(-7), ...(request?.dice ?? [])].map((die) => die.id))
    for (const id of motion.poses.keys()) if (!ids.has(id)) motion.poses.delete(id)
  }, [state.rolledDice, state.lockedDice, state.phase, request, motion, action])
  return <div className="tavern-scene" data-art="realistic" data-quality={presentation.actions.preferences.quality}>
    <div className="scene-canvas" aria-hidden="true"><Canvas frameloop="demand" camera={{ position: [0, .49, .48], near: .008, far: 8, fov: 46 }} dpr={presentation.actions.preferences.quality === 'low' ? 1 : [1, 1.5]} shadows="percentage" gl={{ antialias: true, alpha: false }} fallback={null}>
      <SceneWorld entries={entries} motion={motion} hits={hits} presentation={presentation} action={action} reduced={reduced} onUnavailable={onUnavailable} opponent={opponent} view={view} state={state} appearance={appearance} />
    </Canvas></div>
    <div className="scene-vignette" aria-hidden="true" />
    <div className="scene-hit-layer" role="group" aria-label="桌面上的骰子">{entries.map(({ die, index, locked: isLocked }) => {
      const interactive = !paused && !action && !request && !isLocked && actual.currentPlayer === 'human' && actual.phase === 'selecting' && !actual.doubledSelection && view !== 'opponent'
      const definition = getDieDefinition(die.definitionId), label = (die.value === JOKER ? 'Joker 骰，显示骷髅面' : '骰子点数 ' + die.value) + '，' + definition.name + (isLocked ? '，已锁定' : die.selected ? '，已选择' : '')
      const className = 'dice-hit' + (die.selected ? ' selected' : '') + (isLocked ? ' locked' : '') + (die.selected && !selectionValid ? ' invalid' : '')
      if (interactive) return <button key={die.id} data-die-id={die.id} type="button" className={className} aria-label={label} aria-pressed={die.selected} ref={(el) => { if (el) hits.set(die.id, el); else hits.delete(die.id) }} onClick={() => onToggleDie(die.id)}><span aria-hidden="true">{index + 1}{die.selected ? ' ✓' : ''}</span></button>
      return <span key={die.id} className={className + ' noninteractive'} role="img" aria-label={request && !isLocked ? '骰子正在滚动' : label} ref={(el) => { if (el) hits.set(die.id, el); else hits.delete(die.id) }} />
    })}</div>
    <div className="scene-tray-label"><span>计分托盘</span><span>{state.lockedDice.length ? `${state.lockedDice.length} 颗已锁定` : '留住好运，再掷一把'}</span></div>
    {state.lockedDice.length > 7 && <details className="tray-history"><summary>另有 {state.lockedDice.length - 7} 颗 · 查看记录</summary><p>{state.lockedDice.map((die) => die.value === JOKER ? '骷髅' : die.value).join(' · ')}</p></details>}
  </div>
}
