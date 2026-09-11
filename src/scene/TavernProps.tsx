import type { ThreeElements } from '@react-three/fiber'
import type { MeshToonMaterial } from 'three'
import type { TavernArt } from './materials'

function Block({ size, material, ...props }: ThreeElements['group'] & { size: [number, number, number]; material: MeshToonMaterial }) {
  return (
    <group {...props}>
      <mesh castShadow receiveShadow material={material}><boxGeometry args={size} /></mesh>
      <mesh scale={[1.012, 1.018, 1.012]}>
        <boxGeometry args={size} /><meshBasicMaterial color="#302026" side={1} />
      </mesh>
    </group>
  )
}

function Candle({ art, position, height = 0.9 }: { art: TavernArt; position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      <mesh material={art.colors.copper} castShadow><cylinderGeometry args={[0.38, 0.46, 0.13, 12]} /></mesh>
      <mesh position={[0, height / 2 + 0.08, 0]} material={art.colors.wax} castShadow><cylinderGeometry args={[0.19, 0.23, height, 10]} /></mesh>
      <mesh position={[0, height + 0.27, 0]} scale={[0.12, 0.3, 0.12]}>
        <sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#ffd777" />
      </mesh>
      <mesh position={[0, height + 0.22, 0]} scale={[0.06, 0.17, 0.065]}>
        <sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#fff2c6" />
      </mesh>
    </group>
  )
}

export function TavernProps({ art }: { art: TavernArt }) {
  return (
    <group>
      <Block size={[14.8, 0.6, 9.7]} position={[0, -0.49, 0.2]} material={art.colors.woodDark} />
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[(i - 4) * 1.61, -0.14, 0.2]}>
          <Block size={[1.59, 0.27, 9.35]} material={i % 3 === 0 ? art.colors.woodLight : art.colors.wood} />
          {Array.from({ length: 5 }, (_, j) => (
            <mesh key={j} position={[-0.6 + j * 0.27, 0.142, (j % 2 - 0.5) * 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.015 + (j % 2) * 0.012, 7.5 - j * 0.5]} />
              <meshBasicMaterial color={j % 2 ? '#b57842' : '#85462d'} transparent opacity={0.5} />
            </mesh>
          ))}
          {[-4.1, 4.4].map((z) => <mesh key={z} position={[0.59, 0.147, z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.045, 8]} /><meshBasicMaterial color="#513327" /></mesh>)}
        </group>
      ))}
      {/* Low rails keep the physically simulated dice within a readable area. */}
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <Block size={[0.16, 0.22, 5.1]} position={[sign * 5.4, 0.04, 0]} material={art.colors.woodDark} />
          <Block size={[10.95, 0.22, 0.16]} position={[0, 0.04, sign * 2.5]} material={art.colors.woodDark} />
          <Block size={[10.95, 0.04, 0.035]} position={[0, 0.17, sign * 2.5]} material={art.colors.copper} />
        </group>
      ))}
      <Block size={[9.5, 0.12, 1.25]} position={[0, 0.02, 3.65]} material={art.colors.wine} />
      {[-1, 1].map((sign) => <Block key={sign} size={[9.8, 0.16, 0.12]} position={[0, 0.1, 3.65 + sign * 0.65]} material={art.colors.copper} />)}
      <Candle art={art} position={[6.25, 0.07, -2.6]} height={1.1} />
      <Candle art={art} position={[6.85, 0.07, -1.8]} height={0.6} />
      <group position={[-6.25, 0.6, -1.8]} rotation={[0, 0, -0.13]}>
        <mesh material={art.colors.woodDark} castShadow><cylinderGeometry args={[0.52, 0.43, 1.15, 12]} /></mesh>
        {[-0.42, 0.42].map((y) => <mesh key={y} position={[0, y, 0]} material={art.colors.copper}><cylinderGeometry args={[0.535, 0.52, 0.12, 12]} /></mesh>)}
        <mesh position={[0, 0.581, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.46, 12]} /><meshBasicMaterial color="#302026" /></mesh>
        <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={art.colors.copper}><torusGeometry args={[0.35, 0.1, 6, 12]} /></mesh>
      </group>
      <group position={[5.9, 0.04, 2.3]} rotation={[0, -0.25, 0]}>
        <Block size={[1.2, 0.04, 1.65]} material={art.colors.parchment} />
        {[0, 1, 2, 3].map((i) => <Block key={i} size={[0.72 - i * 0.1, 0.01, 0.025]} position={[0, 0.03, -0.5 + i * 0.23]} material={art.colors.woodDark} />)}
      </group>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[-6.15 + (i % 3) * 0.32, 0.06 + Math.floor(i / 3) * 0.07, 1.5 + (i % 2) * 0.32]} material={art.colors.copper} castShadow><cylinderGeometry args={[0.25, 0.25, 0.065, 12]} /></mesh>)}
      <group position={[0, -1.6, -5.6]}>
        <Block size={[22, 5, 0.5]} material={art.colors.dark} />
        {[-7, 0, 7].map((x) => <Block key={x} size={[0.35, 5, 0.6]} position={[x, 0, 0.3]} material={art.colors.woodDark} />)}
        <Block size={[22, 0.3, 0.7]} position={[0, 0.6, 0.3]} material={art.colors.woodDark} />
      </group>
    </group>
  )
}
