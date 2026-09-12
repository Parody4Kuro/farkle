import { adventureReducer, createAdventure, type AdventureRun } from '../../src/game/adventure'
import { addInventoryItem } from '../../src/game/inventory'

export function openedNight(seed: number, id: string): AdventureRun {
  const run = adventureReducer(createAdventure(seed, id), { type: 'SELECT_CORE', id: 'core-steady' })
  return { ...run, modifiers: [] }
}

export function pendingNight(count = 6, id = 'browser-night'): AdventureRun {
  let run = openedNight(57, id)
  if (count === 7) run = { ...run, modifiers: ['loaded-hand', 'golden-one'],
    inventory: addInventoryItem(addInventoryItem(run.inventory, 'modifier', 'loaded-hand'), 'modifier', 'golden-one') }
  run = adventureReducer(adventureReducer(run, { type: 'SIT' }), { type: 'ROLL' })
  return { ...run, pendingDice: run.pendingDice.map((die, i) => ({ ...die, value: [1, 1, 1, 5, 2, 6, 1][i] as 1 | 2 | 5 | 6 })) }
}

export const savedNight = (run: AdventureRun) => ({ version: 2, run, runtime: { paused: true } })
