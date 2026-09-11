import { mkdir, writeFile } from 'node:fs/promises'
import { initPhysics, simulate } from '../src/scene/physics/simulate'
import type { Trajectory } from '../src/scene/physics/types'

await initPhysics()
const trajectories: Record<string, Trajectory> = {}
for (let count = 1; count <= 7; count++) {
  let result: Trajectory | undefined
  let seed = 0
  for (; seed < 5000 && !result; seed++) result = simulate(count, seed + count * 10000)
  if (!result) throw new Error('No valid trajectory for ' + count + ' dice')
  trajectories[count] = result
  console.log(count + ' dice: seed ' + (seed - 1 + count * 10000) + ', ' + result.frames.length + ' frames')
}
await mkdir('src/scene/physics', { recursive: true })
await writeFile('src/scene/physics/fallback-trajectories.json', JSON.stringify(trajectories, (_key, value: unknown) =>
  typeof value === 'number' ? Math.round(value * 100000) / 100000 : value))
