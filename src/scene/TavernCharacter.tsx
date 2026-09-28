/* oxlint-disable react/immutability -- Skeletal pose state is owned by Three, not React. */
import { useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { AnimationMixer, Bone, Group, Matrix4, Mesh, Quaternion, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { PlayerId } from '../game/types'
import { actionProgress, smooth } from '../presentation/ActionPlayback'
import { actorSide, trayPosition } from './layout'
import { cupTransform, rollElapsed } from './cupMotion'
import type { Motion } from './motion'

const v1 = new Vector3(), v2 = new Vector3(), joint = new Vector3(), end = new Vector3(), q1 = new Quaternion(), q2 = new Quaternion()
/** CCD arm contact correction; animation still provides torso, fingers and expression. */
function reach(root: Group, hand: Bone, chain: Bone[], target: Vector3) {
  for (let pass = 0; pass < 5; pass++) for (const bone of chain) {
    root.updateMatrixWorld(true)
    bone.getWorldPosition(joint); hand.getWorldPosition(end)
    v1.copy(end).sub(joint).normalize(); v2.copy(target).sub(joint).normalize()
    q1.setFromUnitVectors(v1, v2)
    bone.getWorldQuaternion(q2); q1.multiply(q2)
    bone.parent!.getWorldQuaternion(q2).invert()
    bone.quaternion.copy(q2.multiply(q1)).normalize()
  }
  root.updateMatrixWorld(true)
}
function handBasis(root: Group, suffix: string) {
  const hand = root.getObjectByName('hand_' + suffix) as Bone
  const middle = root.getObjectByName('middle_03_' + suffix)!, index = root.getObjectByName('index_01_' + suffix)!, pinky = root.getObjectByName('pinky_01_' + suffix)!
  const forward = middle.getWorldPosition(new Vector3()).sub(hand.getWorldPosition(new Vector3())).normalize()
  const across = index.getWorldPosition(new Vector3()).sub(pinky.getWorldPosition(new Vector3())).normalize().multiplyScalar(suffix === 'l' ? 1 : -1)
  const up = new Vector3().crossVectors(forward, across).normalize()
  across.crossVectors(up, forward).normalize()
  const worldBasis = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across, up, forward))
  const correction = worldBasis.invert().multiply(hand.getWorldQuaternion(new Quaternion()))
  return { hand, correction, chain: ['lowerarm_', 'upperarm_'].map((name) => root.getObjectByName(name + suffix) as Bone) }
}
export function RiggedPerson({ asset, player, presentation, motion, reduced }: {
  asset: string; player: PlayerId; presentation: RollPresentation; motion: Motion; reduced: boolean; handsOnly?: boolean
}) {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}art/characters/${asset}.glb`)
  const rig = useMemo(() => {
    const root = clone(gltf.scene) as Group
    root.traverse((obj) => { if (obj instanceof Mesh) { obj.castShadow = true; obj.receiveShadow = true; obj.frustumCulled = false } })
    root.updateMatrixWorld(true)
    const headHeight = root.getObjectByName('head')!.getWorldPosition(new Vector3()).y
    return { root, seatedHeight: .47 - headHeight, mixer: new AnimationMixer(root), hands: ['l', 'r'].map((s) => handBasis(root, s)) }
  }, [gltf])
  useEffect(() => () => { rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.root) }, [rig])
  useFrame(({ invalidate }) => {
    if (presentation.playback.paused) return
    const side = actorSide(player), request = presentation.getSnapshot(), action = presentation.actions.getSnapshot()
    const elapsed = request?.player === player ? rollElapsed(presentation) : -1
    const progress = action ? actionProgress(action, presentation.playback.now()) : 0
    const p = action?.kind === 'victory' ? Math.min(1, progress / .5) : progress
    const reacts = action?.kind === 'bust' || action?.kind === 'victory'
    let clipName = elapsed >= 0 ? elapsed < 1 ? 'shake' : 'pour' : action?.player === player ? action.kind === 'hot' || action.kind === 'ability' ? 'collect' : action.kind : reacts ? 'inspect' : 'idle'
    if (action?.kind === 'victory') clipName = progress < .55 ? action.player === player ? 'bank' : 'inspect' : action.after.winner === player ? 'victory' : 'defeat'
    const clip = gltf.animations.find((c) => c.name === clipName) ?? gltf.animations[0]
    rig.mixer.stopAllAction()
    if (clip) {
      rig.mixer.clipAction(clip).play()
      const clipProgress = action?.kind === 'victory' && progress >= .55 ? (progress - .55) / .45 : p
      rig.mixer.setTime(reduced ? 0 : action ? clipProgress * clip.duration * .98 : elapsed >= 0 ? Math.min(elapsed / 3, .98) * clip.duration : .2)
    }
    rig.root.updateMatrixWorld(true)
    for (const [i, hand] of rig.hands.entries()) {
      const xside = -side * (i === 0 ? 1 : -1)
      const target = new Vector3(xside * .17, .039, side * .286)
      let gripping = false
      if (!reduced && elapsed >= 0 && i === 0) {
        const cup = cupTransform(elapsed, player)
        const grasp = new Vector3(-.042 * side, 0, .022 * side).applyQuaternion(cup.rotation).add(cup.position)
        grasp.z += .042 * side
        target.lerp(grasp, smooth(elapsed / .22) * (1 - smooth((elapsed - 2.45) / .25))); gripping = elapsed < 2.45
      } else if (!reduced && action?.player === player && i === 1 && action.kind !== 'ability') {
        const moving = action.before.rolledDice.filter((d) => action.diceIds.includes(d.id) || ['bank', 'bust', 'victory'].includes(action.kind))
        const die = moving[Math.min(moving.length - 1, Math.floor(p * moving.length))]
        const pose = die && motion.poses.get(die.id)
        const touch = pose ? new Vector3(...pose.position) : new Vector3(0, .02, 0)
        touch.y += .045
        const order = die ? Math.max(0, action.diceIds.indexOf(die.id)) : 0
        const tray = new Vector3(...trayPosition((action.before.lockedDice.length + order) % 7, player)); tray.y += .04
        const contact = touch.lerp(tray, smooth((p - .2 - order * .018) / .43)); contact.z += side * .045
        target.lerp(contact, smooth(p / .2) * (1 - smooth((p - .78) / .22)))
        gripping = p > .25 && p < .68
      }
      reach(rig.root, hand.hand, hand.chain, target)
      const forward = new Vector3(0, gripping ? -.45 : -.08, -side).normalize()
      const up = new Vector3(0, -1, 0)
      if (gripping && elapsed >= 0 && i === 0) {
        const cup = cupTransform(elapsed, player)
        forward.set(0, 0, -side).applyQuaternion(cup.rotation)
        up.set(side, 0, 0).applyQuaternion(cup.rotation)
      }
      const across = new Vector3().crossVectors(up, forward).normalize(); up.crossVectors(forward, across)
      const orientation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across, up, forward)).multiply(hand.correction)
      if (gripping) for (const finger of ['index','middle','ring','pinky']) for (const segment of ['01','02','03']) {
        const bone = rig.root.getObjectByName(`${finger}_${segment}_${i === 0 ? 'l' : 'r'}`) as Bone | undefined
        if (bone) bone.rotateX(.45)
      }
      hand.hand.parent!.getWorldQuaternion(q1).invert(); hand.hand.quaternion.copy(q1.multiply(orientation)).normalize()
      if (gripping && elapsed >= 0 && i === 0) {
        // Place the fingers around the outside of the cup, including the thumb;
        // fixed Euler curls alone can point through the open lip on mirrored rigs.
        const cup = cupTransform(elapsed, player)
        for (const [fingerIndex, finger] of ['index','middle','ring','pinky','thumb'].entries()) {
          const suffix = i === 0 ? 'l' : 'r'
          const tip = rig.root.getObjectByName(`${finger}_03_${suffix}`) as Bone | undefined
          const chain = ['02','01'].map((segment) => rig.root.getObjectByName(`${finger}_${segment}_${suffix}`) as Bone).filter(Boolean)
          if (tip && chain.length === 2) {
            const point = finger === 'thumb' ? new Vector3(-.037 * side, .026, .028 * side) : new Vector3(-.025 * side, .022 - fingerIndex * .013, -.037 * side)
            point.applyQuaternion(cup.rotation).add(cup.position)
            reach(rig.root, tip, chain, point)
          }
        }
      }
    }
    rig.root.traverse((obj) => {
      if (!(obj instanceof Mesh) || !obj.morphTargetDictionary || !obj.morphTargetInfluences) return
      const expression = action?.kind === 'bust' ? action.player === player ? 'disappointed' : 'pleased' : action?.kind === 'victory' ? action.after.winner === player ? 'pleased' : 'disappointed' : 'thoughtful'
      const strength = action?.kind === 'victory' ? smooth((progress - .55) / .2) * (1 - smooth((progress - .92) / .08)) : Math.sin(p * Math.PI)
      for (const [key, index] of Object.entries(obj.morphTargetDictionary)) obj.morphTargetInfluences[index] = key === expression ? (action ? strength * .8 : .15) : 0
    })
    if (request || action) invalidate()
  }, -1)
  // Exported MPFB units are metres, with feet at zero. A seated torso starts below the tabletop.
  return <group position={[0, rig.seatedHeight, actorSide(player) * .57]} rotation={[0, player === 'human' ? Math.PI : 0, 0]}><primitive object={rig.root} /></group>
}

export function TavernRoom({ moon = false }: { moon?: boolean }) {
  return <group>
    <mesh position={[0, .4, -1.8]} receiveShadow><boxGeometry args={[5, 3.4, .1]} /><meshStandardMaterial color="#3e342a" roughness={1} /></mesh>
    {[-1.8, -.85, .85, 1.8].map((x) => <mesh key={x} position={[x, .4, -1.73]}><boxGeometry args={[.095, 3.4, .12]} /><meshStandardMaterial color="#271b14" roughness={.9} /></mesh>)}
    {[.05, 1.2].map((y) => <mesh key={y} position={[0, y, -1.7]}><boxGeometry args={[5, .08, .16]} /><meshStandardMaterial color="#2f2017" /></mesh>)}
    <group position={[-1.17, .75, -1.64]}>
      <mesh><boxGeometry args={[.56, .85, .05]} /><meshStandardMaterial color={moon ? '#455c71' : '#837758'} emissive={moon ? '#35485c' : '#5a5342'} emissiveIntensity={.45} /></mesh>
      {[0, -.27, .27].map((x) => <mesh key={x} position={[x, 0, .034]}><boxGeometry args={[.027, .88, .04]} /><meshStandardMaterial color="#17120e" /></mesh>)}
      <mesh position={[0, 0, .035]}><boxGeometry args={[.57, .03, .04]} /><meshStandardMaterial color="#17120e" /></mesh>
    </group>
    <mesh position={[.98, -.02, -1.61]}><boxGeometry args={[.68, .72, .27]} /><meshStandardMaterial color="#4b4336" roughness={.95} /></mesh>
    <mesh position={[.98, -.12, -1.465]}><boxGeometry args={[.48, .44, .02]} /><meshStandardMaterial color="#180d09" emissive="#7b2b07" emissiveIntensity={.55} /></mesh>
    <pointLight position={[.94, .04, -1.2]} color="#ffab65" intensity={.65} distance={3} />
  </group>
}
