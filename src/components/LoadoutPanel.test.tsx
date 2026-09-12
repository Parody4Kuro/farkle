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

it('replaces a special die with a fair die, moves it, and submits the actual six-die draft', async () => {
  const user = userEvent.setup(), run = opened(), onSit = vi.fn()
  render(<StrictMode><LoadoutPanel run={run} onSit={onSit} /></StrictMode>)
  const first = screen.getByRole('combobox', { name: '骰子 1' })
  const third = screen.getByRole('combobox', { name: '骰子 3' })
  expect(within(first).getByRole('option', { name: /公平骰 · 持有 6 · 已装备 4 · 空闲 2/ }).hasAttribute('disabled')).toBe(false)
  expect(within(third).getByRole('option', { name: /工匠之五.*全部已装备/ }).hasAttribute('disabled')).toBe(true)
  await user.selectOptions(first, 'standard')
  expect(within(first).getByRole('option', { name: /公平骰 · 持有 6 · 已装备 5 · 空闲 1/ })).not.toBeNull()
  await user.selectOptions(third, 'lucky-five')
  await user.click(screen.getByRole('button', { name: '入座，开始这一桌' }))
  expect(onSit).toHaveBeenLastCalledWith(['standard', 'high-roller', 'lucky-five', 'standard', 'standard', 'standard'], ['core-steady'])
  expect(run.loadout[0]).toBe('lucky-five')
  expect(run.inventory.dice.standard).toBe(6)
  await user.click(screen.getByRole('button', { name: '全部换回公平骰' }))
  await user.click(screen.getByRole('button', { name: '入座，开始这一桌' }))
  expect(onSit).toHaveBeenLastCalledWith(Array(6).fill('standard'), ['core-steady'])
  await user.selectOptions(first, 'lucky-five')
  await user.selectOptions(first, 'standard')
  expect((first as HTMLSelectElement).value).toBe('standard')
})

it('explains badge restrictions and supports removal, movement and replacement without losing ownership', async () => {
  const user = userEvent.setup(), onSit = vi.fn()
  let run = opened()
  for (const id of ['golden-one', 'core-kindred']) run = { ...run, inventory: addInventoryItem(run.inventory, 'modifier', id) }
  render(<LoadoutPanel run={run} onSit={onSit} />)
  const first = screen.getByRole('combobox', { name: '徽章 1' })
  const second = screen.getByRole('combobox', { name: '徽章 2' })
  expect(within(second).getByRole('option', { name: /铜筹账簿.*另一槽位已佩戴/ }).hasAttribute('disabled')).toBe(true)
  expect(within(second).getByRole('option', { name: /同契纹章.*核心最多一枚/ }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: '卸下徽章 1' }))
  await user.selectOptions(second, 'core-steady')
  await user.selectOptions(first, 'golden-one')
  await user.selectOptions(second, 'core-kindred')
  await user.click(screen.getByRole('button', { name: '入座，开始这一桌' }))
  expect(onSit).toHaveBeenCalledWith(run.loadout, ['golden-one', 'core-kindred'])
  expect(screen.getByRole('status').textContent).toContain('已装备 6 颗骰子、2 枚徽章')
  expect(run.inventory.modifiers).toEqual(['core-steady', 'golden-one', 'core-kindred'])
})

it.each([1, 2] as const)('shows descriptions matching the saved scoring version %i', (version) => {
  const run = { ...opened(), scoringVersion: version }
  const { unmount } = render(<LoadoutPanel run={run} onSit={vi.fn()} />)
  expect(screen.getByText(/目前仅持有一枚徽章/)).not.toBeNull()
  expect(screen.getByText(getModifier('core-steady', version)!.description)).not.toBeNull()
  expect(screen.queryByText(/本夜沿用旧版计分/) !== null).toBe(version === 1)
  unmount()
  render(<RulesModal onClose={vi.fn()} scoringVersion={version} />)
  expect(screen.getByText(getModifier('core-steady', version)!.example!)).not.toBeNull()
  expect(screen.queryByText(/本夜沿用旧版计分/) !== null).toBe(version === 1)
})
