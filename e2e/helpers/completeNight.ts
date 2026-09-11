import { expect, type Page } from '@playwright/test'
import { chooseAiDice, shouldAiContinue } from '../../src/game/ai'
import { DIE_DEFINITIONS } from '../../src/game/dice'
import { MODIFIERS } from '../../src/game/modifiers'
import { bustProbability } from '../../src/game/risk'
import type { DiceValue } from '../../src/game/types'

/** Exercise the same visible controls in the browser and packaged desktop game. */
export async function playCompleteNight(page: Page) {
  const loadout = Array<string>(6).fill('standard')
  const modifiers: string[] = []
  const priorities = ['lucky-charm', 'loaded-hand', 'lucky-one', 'joker', 'golden-one', 'lucky-five', 'double-down', 'odd-fellow', 'high-roller']
  for (let step = 0; step < 180; step++) {
    await expect.poll(async () => {
      const stage = await page.locator('.night-shell').getAttribute('class')
      if (!stage?.includes('stage-playing')) return true
      return ['ready', 'selecting'].includes(await page.locator('.night-shell').getAttribute('data-flow') ?? '')
    }, { timeout: 20000 }).toBe(true)
    const stage = await page.locator('.night-shell').getAttribute('class')
    if (stage?.includes('stage-won') || stage?.includes('stage-lost')) break
    if (stage?.includes('stage-seat')) { await page.getByRole('button', { name: '入座，开始这一桌', exact: true }).click(); continue }
    if (stage?.includes('stage-reward')) {
      const names = await page.locator('.loot-card strong').allTextContents()
      const options = names.map((name) => {
        const die = DIE_DEFINITIONS.find((d) => d.name === name)
        return { name, kind: die ? 'die' : 'modifier', id: die?.id ?? MODIFIERS.find((m) => m.name === name)!.id }
      })
      const pick = options.sort((a, b) => priorities.indexOf(a.id) - priorities.indexOf(b.id))[0]
      await page.locator('.loot-card').filter({ hasText: pick.name }).click()
      if (pick.kind === 'die') {
        const slot = Math.max(0, loadout.indexOf('standard'))
        await page.locator('.slot-grid button').nth(slot).click()
        loadout[slot] = pick.id
      } else if (modifiers.length < 2) {
        await page.getByRole('button', { name: `装备${pick.name}`, exact: true }).click()
        modifiers.push(pick.id)
      } else { await page.locator('.slot-grid button').first().click(); modifiers[0] = pick.id }
      continue
    }
    if (await page.locator('.night-shell').getAttribute('data-flow') === 'ready') {
      await page.getByRole('button', { name: '掷骰子', exact: true }).click(); continue
    }
    const labels = await page.locator('button.dice-hit').evaluateAll((elements) => elements.map((e) => e.getAttribute('aria-label')!))
    const values: DiceValue[] = labels.map((label) => label.startsWith('Joker') ? 'JOKER' : Number(label.match(/点数 (\d)/)![1]) as DiceValue)
    const best = chooseAiDice(values)
    for (const index of best.indices) await page.locator('button.dice-hit').nth(index).click()
    const hot = best.indices.length === values.length
    const ids = hot ? [...loadout, ...(modifiers.includes('loaded-hand') ? ['standard'] : [])]
      : labels.filter((_l, i) => !best.indices.includes(i)).map((label) => DIE_DEFINITIONS.find((d) => label.includes(d.name))!.id)
    const humanScore = Number((await page.locator('.night-scoreband > div').first().locator('strong').innerText()).replaceAll(',', ''))
    const aiScore = Number((await page.locator('.night-scoreband > div').last().locator('strong').innerText()).replaceAll(',', ''))
    const targetScore = Number((await page.locator('.night-target strong').innerText()).replaceAll(',', ''))
    const turnScore = Number((await page.locator('.pot-label b').innerText()).replaceAll(',', '')) + best.score
    const again = shouldAiContinue({ difficulty: 'normal', turnScore, remainingDice: ids.length, aiScore: humanScore,
      humanScore: aiScore, targetScore, hotDice: hot, bustProbability: bustProbability(ids) })
    await page.getByRole('button', { name: again ? '锁定并继续掷骰' : '保存分数', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: '今夜，皇冠属于你。' })).toBeVisible()
  await expect(page.locator('.night-history li')).toHaveCount(4)
}
