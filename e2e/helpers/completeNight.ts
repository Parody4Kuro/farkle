import { expect, type Page } from '@playwright/test'
import { chooseAiDice, shouldAiContinue } from '../../src/game/ai'
import { DIE_DEFINITIONS } from '../../src/game/dice'
import { MODIFIERS } from '../../src/game/modifiers'
import { bustProbability } from '../../src/game/risk'
import { SCORING_VERSION } from '../../src/game/scoringVersions'
import type { DiceValue } from '../../src/game/types'

// Deterministic winning path for this UI strategy under scoring v2. Seed 1
// now loses at table 2; keep the full four-table acceptance flow reproducible.
export const COMPLETE_NIGHT_SEED = 2

/** Exercise the same visible controls in the browser and packaged desktop game. */
export async function playCompleteNight(page: Page, activate?: () => Promise<void>) {
  const loadout = Array<string>(6).fill('standard')
  let modifiers: string[] = []
  const ownedBadges: string[] = []
  const priorities = ['core-steady', 'lucky-charm', 'loaded-hand', 'lucky-one', 'joker', 'golden-one', 'lucky-five', 'double-down', 'odd-fellow', 'high-roller']
  for (let step = 0; step < 180; step++) {
    await activate?.()
    await expect.poll(async () => {
      const stage = await page.locator('.night-shell').getAttribute('class')
      if (!stage?.includes('stage-playing')) return true
      if (await page.locator('.night-shell').getAttribute('data-paused') === 'true') return true
      return ['ready', 'selecting'].includes(await page.locator('.night-shell').getAttribute('data-flow') ?? '')
    }, { timeout: 20000 }).toBe(true)
    const stage = await page.locator('.night-shell').getAttribute('class')
    if (await page.getByRole('button', { name: '继续', exact: true }).isVisible()) {
      await activate?.()
      if (await page.getByRole('button', { name: '继续', exact: true }).isVisible()) await page.getByRole('button', { name: '继续', exact: true }).click()
      continue
    }
    if (stage?.includes('stage-core')) {
      await page.getByRole('button', { name: '选择铜筹账簿', exact: true }).click()
      modifiers = ['core-steady']; ownedBadges.push('core-steady'); continue
    }
    if (stage?.includes('stage-won') || stage?.includes('stage-lost')) break
    if (stage?.includes('stage-seat')) {
      for (let i = 0; i < 6; i++) await page.getByRole('combobox', { name: new RegExp('^骰子 ' + (i + 1)) }).selectOption(loadout[i])
      for (let i = 0; i < 2; i++) await page.getByRole('combobox', { name: new RegExp('^徽章 ' + (i + 1)) }).selectOption('')
      for (let i = 0; i < modifiers.length; i++) await page.getByRole('combobox', { name: new RegExp('^徽章 ' + (i + 1)) }).selectOption(modifiers[i])
      await page.getByRole('button', { name: '入座，开始这一桌', exact: true }).click(); continue
    }
    if (stage?.includes('stage-reward')) {
      const names = await page.locator('.loot-card strong').allTextContents()
      const options = names.map((name) => {
        const die = DIE_DEFINITIONS.find((d) => d.name === name)
        return { name, kind: die ? 'die' : 'modifier', id: die?.id ?? MODIFIERS.find((m) => m.name === name)!.id }
      })
      const pick = options.sort((a, b) => (priorities.includes(a.id) ? priorities.indexOf(a.id) : 99) - (priorities.includes(b.id) ? priorities.indexOf(b.id) : 99))[0]
      await page.locator('.loot-card').filter({ hasText: pick.name }).click()
      await page.getByRole('button', { name: /^收入行囊/ }).click()
      if (pick.kind === 'die') {
        const slot = Math.max(0, loadout.indexOf('standard'))
        loadout[slot] = pick.id
      } else {
        ownedBadges.push(pick.id)
        modifiers = [...ownedBadges].sort((a, b) => (priorities.includes(a) ? priorities.indexOf(a) : 99) - (priorities.includes(b) ? priorities.indexOf(b) : 99))
          .filter((id) => !id.startsWith('core-') || id === 'core-steady').slice(0, 2)
      }
      continue
    }
    if (await page.locator('.night-shell').getAttribute('data-flow') === 'ready') {
      await page.getByRole('button', { name: '掷骰子', exact: true }).click(); continue
    }
    const labels = await page.locator('button.dice-hit').evaluateAll((elements) => elements.map((e) => e.getAttribute('aria-label')!))
    const values: DiceValue[] = labels.map((label) => label.startsWith('Joker') ? 'JOKER' : Number(label.match(/点数 (\d)/)![1]) as DiceValue)
    const best = chooseAiDice(values, { modifierIds: modifiers, player: 'human', version: SCORING_VERSION })
    for (const index of best.indices) { await activate?.(); await page.locator('button.dice-hit').nth(index).click() }
    const hot = best.indices.length === values.length
    const ids = hot ? [...loadout, ...(modifiers.includes('loaded-hand') ? ['standard'] : [])]
      : labels.filter((_l, i) => !best.indices.includes(i)).map((label) => DIE_DEFINITIONS.find((d) => label.includes(d.name))!.id)
    const humanScore = Number((await page.locator('.night-scoreband > div').first().locator('strong').innerText()).replaceAll(',', ''))
    const aiScore = Number((await page.locator('.night-scoreband > div').last().locator('strong').innerText()).replaceAll(',', ''))
    const targetScore = Number((await page.locator('.night-target strong').innerText()).replaceAll(',', ''))
    const turnScore = Number((await page.locator('.pot-label b').innerText()).replaceAll(',', '')) + best.score
    const again = shouldAiContinue({ difficulty: 'normal', turnScore, remainingDice: ids.length, aiScore: humanScore,
      humanScore: aiScore, targetScore, hotDice: hot, bustProbability: bustProbability(ids) })
    await activate?.()
    await page.getByRole('button', { name: again ? '锁定并继续掷骰' : '保存分数', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: '今夜，皇冠属于你。' })).toBeVisible()
  expect(await page.locator('.night-history li').count()).toBeGreaterThanOrEqual(4)
  expect(await page.locator('.night-history li').count()).toBeLessThanOrEqual(5)
}
