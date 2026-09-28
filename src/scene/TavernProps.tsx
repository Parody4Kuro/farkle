import type { ThreeElements } from '@react-three/fiber'
import type { Material } from 'three'
import type { TavernArt } from './materials'
import { TABLE } from './layout'

function Block({ size, material, ...props }: ThreeElements['group'] & { size: [number, number, number]; material: Material }) {
  return <group {...props}><mesh castShadow receiveShadow material={material}><boxGeometry args={size} /></mesh></group>
}
function Candle({ art, position, height = .115 }: { art: TavernArt; position: [number, number, number]; height?: number }) {
  return <group position={position}>
    <mesh material={art.colors.copper} castShadow><cylinderGeometry args={[.033, .041, .012, 32]} /></mesh>
    <mesh position={[0, height / 2 + .01, 0]} material={art.colors.wax} castShadow><cylinderGeometry args={[.015, .018, height, 32]} /></mesh>
    <mesh position={[0, height + .024, 0]} scale={[.004, .012, .004]}><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color="#ffe6a5" /></mesh>
    <pointLight position={[0, height + .034, 0]} intensity={.045} distance={.65} decay={2} color="#ffbc72" />
  </group>
}
export function TavernProps({ art }: { art: TavernArt }) {
  return <group>
    <Block size={[1.42, .055, .95]} position={[0, -.041, 0]} material={art.colors.woodDark} />
    {Array.from({ length: 8 }, (_, i) => <Block key={i} size={[.1745, .028, .94]} position={[(i - 3.5) * .176, -.014, 0]} material={art.colors.wood} />)}
    {[-1, 1].map((side) => <group key={side}>
      <Block size={[.008, .032, TABLE.arenaZ * 2]} position={[side * TABLE.arenaX, .004, 0]} material={art.colors.woodDark} />
      <Block size={[TABLE.arenaX * 2 + .008, .032, .008]} position={[0, .004, side * TABLE.arenaZ]} material={art.colors.woodDark} />
      <Block size={[TABLE.arenaX * 2 + .008, .002, .002]} position={[0, .021, side * TABLE.arenaZ]} material={art.colors.copper} />
      <Block size={[.35, .005, .056]} position={[0, .0005, side * TABLE.trayZ]} material={art.colors.leather} />
      {[-1, 1].map((edge) => <Block key={edge} size={[.36, .008, .004]} position={[0, .004, side * TABLE.trayZ + edge * .031]} material={art.colors.copper} />)}
    </group>)}
    <Candle art={art} position={[.35, .008, -.21]} />
    <Candle art={art} position={[.405, .008, -.16]} height={.065} />
    <group position={[-.37, .06, -.12]}>
      <mesh material={art.colors.woodDark} castShadow><cylinderGeometry args={[.046, .039, .12, 32]} /></mesh>
      {[-.045, .047].map((y) => <mesh key={y} position={[0, y, 0]} material={art.colors.copper}><cylinderGeometry args={[.047, .045, .01, 32]} /></mesh>)}
      <mesh position={[0, .0605, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.042, 32]} /><meshStandardMaterial color="#21120b" roughness={.14} /></mesh>
      <mesh position={[-.055, 0, 0]} material={art.colors.copper}><torusGeometry args={[.033, .008, 12, 24]} /></mesh>
    </group>
    <group position={[.33, .012, .15]} rotation={[0, -.25, 0]}>
      <Block size={[.13, .022, .175]} material={art.colors.leather} />
      <Block size={[.116, .012, .16]} position={[0, .009, 0]} material={art.colors.parchment} />
      {[0, 1, 2, 3, 4, 5].map((i) => <Block key={i} size={[.076 - (i % 3) * .012, .0005, .0012]} position={[0, .016, -.055 + i * .018]} material={art.colors.woodDark} />)}
    </group>
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-.35 + i % 3 * .02, .004 + Math.floor(i / 3) * .0025, .12 + i % 2 * .02]} material={art.colors.copper} castShadow><cylinderGeometry args={[.011, .011, .002, 24]} /></mesh>)}
  </group>
}
