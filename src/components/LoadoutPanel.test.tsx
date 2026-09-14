// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adventureReducer, createAdventure } from '../game/adventure'
import { addInventoryItem } from '../game/inventory'
import { getModifier } from '../game/modifiers'
import { RulesModal } from './RulesModal'
import { LoadoutPanel } from './LoadoutPanel'
afterEach(cleanup)
const opened = () => adventureReducer(createAdventure(17, 'prepare', 'artisan'), { type: 'SELECT_CORE', id: 'core-steady' })
const slot = (kind: string, n: number) => screen.getByRole('button', { name: new RegExp(`^${kind} ${n}：`) })
const bag = () => within(screen.getByLabelText('行囊物品'))
it('swaps owned dice directly, prevents over-equipping and submits an isolated six-die draft', async () => {
  const user = userEvent.setup(), run = opened(), onSit = vi.fn()
  render(<StrictMode><LoadoutPanel run={run} onSit={onSit} /></StrictMode>)
  await user.click(slot('骰子', 1)); await user.click(slot('骰子', 3))
  await user.click(screen.getByRole('button', { name: '入座，开始这一桌' }))
  expect(onSit).toHaveBeenLastCalledWith(['standard', 'high-roller', 'lucky-five', 'standard', 'standard', 'standard'], ['core-steady'])
  expect(run.loadout[0]).toBe('lucky-five')
  await user.click(slot('骰子', 4)); await user.click(bag().getByRole('button', { name: /工匠之五/ }))
  expect(slot('骰子', 4).getAttribute('aria-label')).toContain('公平骰')
  expect(screen.getByText(/已全部装备，可点选/)).not.toBeNull()
  await user.click(screen.getByRole('button', { name: '全部换回公平骰' }))
  await user.click(screen.getByRole('button', { name: '入座，开始这一桌' }))
  expect(onSit).toHaveBeenLastCalledWith(Array(6).fill('standard'), ['core-steady'])
})
it('moves and replaces badges with keyboard while preserving ownership and the one-core limit', async () => {
  const user = userEvent.setup(), onSit = vi.fn()
  let run = opened()
  for (const id of ['golden-one', 'core-kindred']) run = { ...run, inventory: addInventoryItem(run.inventory, 'modifier', id) }
  render(<LoadoutPanel run={run} onSit={onSit} />)
  slot('徽章', 1).focus(); await user.keyboard('e'); await user.click(slot('徽章', 2))
  expect(slot('徽章', 2).getAttribute('aria-label')).toContain('铜筹账簿')
  await user.click(slot('徽章', 1)); await user.click(bag().getByRole('button', { name: /同契纹章/ }))
  expect(screen.getByText(/核心最多一枚/)).not.toBeNull()
  await user.click(bag().getByRole('button', { name: /黄金一点/ }))
  await user.click(slot('徽章', 2)); await user.click(bag().getByRole('button', { name: /同契纹章/ }))
  await user.click(screen.getByRole('button', { name: '入座，开始这一桌' }))
  expect(onSit).toHaveBeenCalledWith(run.loadout, ['golden-one', 'core-kindred'])
  expect(run.inventory.modifiers).toEqual(['core-steady', 'golden-one', 'core-kindred'])
})
it.each([1, 2] as const)('shows details matching the saved scoring version %i on focus', async (version) => {
  const user = userEvent.setup(), run = { ...opened(), scoringVersion: version }
  const { unmount } = render(<LoadoutPanel run={run} onSit={vi.fn()} />)
  await user.click(slot('徽章', 1))
  expect(screen.getByText(getModifier('core-steady', version)!.description)).not.toBeNull()
  expect(screen.queryByText(/本夜沿用旧版计分/) !== null).toBe(version === 1)
  unmount(); render(<RulesModal onClose={() => {}} scoringVersion={version} />)
  expect(screen.getByText(getModifier('core-steady', version)!.example!)).not.toBeNull()
})
