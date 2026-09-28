import { initPhysics, simulate } from './simulate'
import type { PhysicsRequest, PhysicsResponse } from './types'

self.onmessage = async (event: MessageEvent<PhysicsRequest>) => {
  const { id, count, seed, player, origin } = event.data
  try {
    await initPhysics()
    let trajectory
    for (let attempt = 0; attempt < 3 && !trajectory; attempt++) {
      trajectory = simulate(count, seed + attempt * 7919, player, origin)
    }
    self.postMessage({ id, trajectory } satisfies PhysicsResponse)
  } catch {
    self.postMessage({ id } satisfies PhysicsResponse)
  }
}
