import { DEFAULT_LOADOUT, DIE_DEFINITIONS } from './dice'
import { getModifier } from './modifiers'

/** Counts include equipped items. Loaded Hand's temporary die is never owned. */
export interface Inventory { dice: Record<string, number>; modifiers: string[] }

export function createInventory(loadout: readonly string[], modifiers: readonly string[] = []): Inventory {
  const dice: Record<string, number> = Object.create(null)
  for (const id of loadout) dice[id] = (dice[id] ?? 0) + 1
  return { dice, modifiers: [...new Set(modifiers)] }
}

/** Baseline ownership is independent of the six equipped dice. Idempotent for saved bags. */
export function ensureBaseDice(inventory: Inventory): Inventory {
  const baseline = createInventory(DEFAULT_LOADOUT).dice
  const dice = { ...inventory.dice }
  for (const [id, count] of Object.entries(baseline)) dice[id] = Math.max(dice[id] ?? 0, count)
  return { dice, modifiers: [...inventory.modifiers] }
}

export function createStartingInventory(loadout: readonly string[], modifiers: readonly string[] = []): Inventory {
  return ensureBaseDice(createInventory(loadout, modifiers))
}

export function addInventoryItem(inventory: Inventory, kind: 'die' | 'modifier', id: string): Inventory {
  if (kind === 'die') {
    if (!DIE_DEFINITIONS.some((d) => d.id === id)) return inventory
    return { ...inventory, dice: { ...inventory.dice, [id]: (inventory.dice[id] ?? 0) + 1 } }
  }
  if (!getModifier(id) || inventory.modifiers.includes(id)) return inventory
  return { ...inventory, modifiers: [...inventory.modifiers, id] }
}

export function loadoutError(inventory: Inventory, loadout: readonly string[], modifiers: readonly string[]): string | null {
  if (loadout.length !== 6) return '骰盅需要恰好六颗骰子。'
  if (loadout.some((id) => !DIE_DEFINITIONS.some((d) => d.id === id))) return '行囊中没有这种骰子。'
  const counts = createInventory(loadout).dice
  if (Object.entries(counts).some(([id, count]) => !DIE_DEFINITIONS.some((d) => d.id === id) || count > (inventory.dice[id] ?? 0))) return '选用的骰子超过了行囊中的数量。'
  if (modifiers.length > 2) return '最多佩戴两枚徽章。'
  if (new Set(modifiers).size !== modifiers.length || modifiers.some((id) => !getModifier(id) || !inventory.modifiers.includes(id))) return '只能佩戴行囊中已有的不同徽章。'
  if (modifiers.filter((id) => getModifier(id)?.category === 'core').length > 1) return '最多佩戴一枚核心徽章。'
  return null
}
