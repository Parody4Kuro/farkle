import { test, expect, type Page } from '@playwright/test'
import { adventureReducer, createAdventure, type AdventureRun } from '../src/game/adventure'
import { ADVENTURE_KEY, COMFORT_KEY } from '../src/storage/adventureStorage'
import { playCompleteNight } from './helpers/completeNight'

function pending(count = 6): AdventureRun {
  let run = createAdventure(57, 'browser-night')
  if (count === 7) run = { ...run, modifiers: ['loaded-hand', 'golden-one'] }
  run = adventureReducer(adventureReducer(run, { type: 'SIT' }), { type: 'ROLL' })
  return { ...run, pendingDice: run.pendingDice.map((die, i) => ({ ...die, value: [1, 1, 1, 5, 2, 6, 1][i] as 1 | 2 | 5 | 6 })) }
}

async function openNight(page: Page, run?: AdventureRun) {
  await page.addInitScript(({ run, key, comfortKey }) => {
    if (run && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(run))
    localStorage.setItem(comfortKey, JSON.stringify({ fast: true, dialogue: true, environment: 0, music: 0 }))
  }, { run, key: ADVENTURE_KEY, comfortKey: COMFORT_KEY })
  await page.goto('/')
  if (run) await page.getByRole('button', { name: /^继续这一夜/ }).click()
  else await page.getByRole('button', { name: '开始酒馆之夜', exact: true }).click()
}

test('lobby, public opponent, first-person views and keyboard banking', async ({ page }, info) => {
  await openNight(page, pending())
  await expect(page.locator('button.dice-hit')).toHaveCount(6)
  await page.getByRole('button', { name: '看向对手', exact: true }).click()
  await expect(page.getByRole('button', { name: '看向对手', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('button.dice-hit')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('opponent.png') })
  await page.getByRole('button', { name: '俯身看骰', exact: true }).click()
  await expect(page.locator('button.dice-hit')).toHaveCount(6)
  await page.locator('button.dice-hit').first().focus()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('计分明细')).toContainText('单颗 1')
  await expect(page.getByLabel('计分明细')).toContainText('可落袋 100')
  await page.getByRole('button', { name: '保存分数', exact: true }).click()
  await expect(page.locator('.night-scoreband > div').first()).toContainText('100')
  await expect(page.getByRole('button', { name: '掷骰子', exact: true })).toBeEnabled({ timeout: 20000 })
  await page.getByRole('button', { name: '保存并返回酒馆' }).click()
  await expect(page.getByRole('button', { name: /^继续这一夜/ })).toBeVisible()
})

test('seven-die selection survives refresh and layouts keep controls usable', async ({ page }, info) => {
  await openNight(page, pending(7))
  await expect(page.locator('button.dice-hit')).toHaveCount(7)
  await page.locator('button.dice-hit').first().click()
  const labels = await page.locator('button.dice-hit').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  await page.reload()
  await page.getByRole('button', { name: /^继续这一夜/ }).click()
  await expect(page.locator('button.dice-hit')).toHaveCount(7)
  expect(await page.locator('button.dice-hit').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(labels)
  for (const [width, height] of [[1280, 720], [1920, 1080], [2560, 1080]]) {
    await page.setViewportSize({ width, height })
    await expect(page.getByRole('button', { name: '保存分数', exact: true })).toBeInViewport()
    await expect(page.getByRole('button', { name: '锁定并继续掷骰', exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.screenshot({ path: info.outputPath(`night-${width}.png`) })
  }
})

test('victory rewards replace a die, persist once, and become the next match loadout', async ({ page }) => {
  const run = pending()
  run.game.turnScore = 1950
  await openNight(page, run)
  await expect(page.locator('button.dice-hit')).toHaveCount(6)
  await page.locator('button.dice-hit').first().click()
  await page.getByRole('button', { name: '保存分数', exact: true }).click()
  await expect(page.getByRole('heading', { name: '赢来的，选一件带走。' })).toBeVisible()
  const dieCard = page.locator('.loot-card').filter({ hasText: '一颗特殊骰' }).first()
  const rewardName = await dieCard.locator('strong').innerText()
  await dieCard.click()
  await page.getByRole('button', { name: '位置 1 公平骰', exact: true }).click()
  await expect(page.getByRole('heading', { name: '炉火桌，有人等你。' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^继续这一夜/ }).click()
  await page.getByRole('button', { name: '入座，开始这一桌', exact: true }).click()
  await page.getByRole('button', { name: '掷骰子', exact: true }).click()
  await expect(page.locator('button.dice-hit').filter({ has: page.locator('span') })).toHaveCount(6)
  await expect(page.locator('button.dice-hit').first()).toHaveAttribute('aria-label', new RegExp(rewardName))
})

test('third badge needs replacement and keeps the two-slot limit', async ({ page }) => {
  const run = pending()
  run.stage = 'reward'; run.flow = 'done'; run.pendingDice = []; run.game.phase = 'game_over'; run.game.winner = 'human'
  run.modifiers = ['loaded-hand', 'golden-one']
  run.game.config.modifierIds = [...run.modifiers]
  run.rewards = [{ id: 'charm', kind: 'modifier', definitionId: 'lucky-charm' }, { id: 'joker', kind: 'die', definitionId: 'joker' }, { id: 'double', kind: 'modifier', definitionId: 'double-down' }]
  await openNight(page, run)
  await page.locator('.loot-card').filter({ hasText: '幸运护符' }).click()
  await expect(page.getByRole('heading', { name: '替换哪枚徽章？' })).toBeVisible()
  await page.getByRole('button', { name: '替换黄金一点', exact: true }).click()
  await expect(page.locator('.night-footer')).toContainText('徽章 2 / 2')
})

test('first boss loss offers one retry with a fresh 4000-point match', async ({ page }) => {
  let run = { ...createAdventure(52, 'boss-retry'), table: 3 }
  run = adventureReducer(run, { type: 'SIT' })
  run = { ...run, flow: 'decide', game: { ...run.game, phase: 'ai_thinking', currentPlayer: 'ai', turnScore: 3950,
    rolledDice: [{ id: 'boss1', definitionId: 'standard', value: 1, selected: true }] } }
  await openNight(page, run)
  await expect(page.getByRole('heading', { name: '最后一次机会。' })).toBeVisible()
  await expect(page.locator('.night-footer')).toContainText('失利 1 / 2')
  await page.getByRole('button', { name: '入座，开始这一桌', exact: true }).click()
  await expect(page.locator('.night-target')).toContainText('4,000')
  await expect(page.locator('.night-scoreband > div').first()).toContainText('0')
})

test('winning the night unlocks origins and memories exactly once after refresh', async ({ page }) => {
  const run = pending()
  run.table = 3
  run.game.config.targetScore = 4000
  run.game.turnScore = 3950
  await openNight(page, run)
  await expect(page.locator('button.dice-hit')).toHaveCount(6)
  await page.locator('button.dice-hit').first().click()
  await page.getByRole('button', { name: '保存分数', exact: true }).click()
  await expect(page.getByRole('heading', { name: '今夜，皇冠属于你。' })).toBeVisible()
  await page.getByRole('button', { name: /收起行囊，回到酒馆/ }).click()
  await expect(page.locator('.origin-picker option')).toHaveCount(3)
  await expect(page.locator('.lobby-footer')).toContainText('1 夜故事 · 1 次通关')
  await page.reload()
  await expect(page.locator('.lobby-footer')).toContainText('1 夜故事 · 1 次通关')
  await page.getByRole('button', { name: /酒馆记忆/ }).click()
  await expect(page.locator('.memory-book')).toContainText('布兰赢过一顶真正的皇冠')
})

test('pending results survive missing Worker, WebGL loss, and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { window.Worker = class { constructor() { throw new Error('test unavailable') } } as unknown as typeof Worker })
  await openNight(page, pending(7))
  await expect(page.locator('button.dice-hit')).toHaveCount(7)
  await page.locator('.scene-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
  })
  await expect(page.locator('.using-fallback')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /骰子点数 1，公平骰/ })).toHaveCount(4)
  await page.getByRole('button', { name: /骰子点数 1，公平骰/ }).first().click()
  await page.getByRole('button', { name: '保存分数', exact: true }).click()
  await expect(page.locator('.night-scoreband > div').first()).toContainText('100')
})

test('corrupt adventure save leaves classic and new adventures available', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{bad json'), ADVENTURE_KEY)
  await page.goto('/')
  await expect(page.getByRole('button', { name: '开始酒馆之夜', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^继续这一夜/ })).toHaveCount(0)
  await page.getByRole('button', { name: '经典对局', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '准备这张赌桌' })).toBeVisible()
})

test('plays an entire seeded night through visible controls and weighted rolls', async ({ page }) => {
  test.setTimeout(180000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openNight(page, createAdventure(1, 'complete-night'))
  await playCompleteNight(page)
})
