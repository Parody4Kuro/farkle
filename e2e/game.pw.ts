import { equipItem } from './helpers/equipment'
import { test, expect, type Page } from '@playwright/test'

async function openGame(page: Page, random = 0) {
  await page.addInitScript((value) => { Math.random = () => value }, random)
  await page.goto('/')
  await page.getByRole('button', { name: '经典对局', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.tavern-scene, .using-fallback')).toHaveCount(1)
}

async function start(page: Page) {
  await page.getByRole('button', { name: '开始游戏', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function roll(page: Page, count: number) {
  await page.getByRole('button', { name: /掷骰子|锁定并继续掷骰/ }).click()
  await expect(page.locator('button.dice-hit')).toHaveCount(count)
}

test('physical landing, keyboard selection, locked tray, bank and AI handoff', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openGame(page)
  await start(page)
  await expect(page.locator('.using-fallback')).toHaveCount(0)
  await roll(page, 6)
  const dice = page.locator('button.dice-hit')
  const before = await dice.evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }))
  expect(Math.max(...before.map((p) => p.y)) - Math.min(...before.map((p) => p.y))).toBeGreaterThan(8)
  await dice.first().focus()
  await page.keyboard.press('Space')
  await expect(dice.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '保存分数' })).toBeEnabled()
  await roll(page, 5)
  await expect(page.locator('.dice-hit.locked')).toHaveCount(1)
  await expect(page.locator('.turn-stats').getByText('100', { exact: true })).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('table.png'), fullPage: true })
  await page.locator('button.dice-hit').first().click()
  await page.getByRole('button', { name: '保存分数' }).click()
  await expect(page.locator('.score-card.human strong')).toHaveText('200')
  await expect(page.locator('.table-heading h2')).toHaveText('老板的骰局')
  await expect(page.locator('.game-shell')).not.toHaveClass(/phase-rolling/)
  expect(errors).toEqual([])
})

test('seven dice and repeated Hot Dice preserve all locked history and can win', async ({ page }) => {
  await openGame(page)
  await equipItem(page, 'badge', 0, 'loaded-hand')
  await start(page)
  await roll(page, 7)
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 7; i++) await page.locator('button.dice-hit').nth(i).click()
    await roll(page, 7)
  }
  await expect(page.locator('.dice-hit.locked')).toHaveCount(7)
  await page.getByText('另有 7 颗 · 查看记录').click()
  await expect(page.locator('.tray-history p')).toContainText('1 · 1')
  await page.locator('button.dice-hit').first().click()
  await page.getByRole('button', { name: '保存分数' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.game-shell')).toHaveClass(/phase-game_over/)
})

test('Joker skins, golden one and double down stay synchronized with selection', async ({ page }) => {
  await openGame(page, 0.999)
  for (let i = 0; i < 6; i++) await equipItem(page, 'die', i, 'joker')
  await equipItem(page, 'badge', 0, 'golden-one')
  await equipItem(page, 'badge', 1, 'double-down')
  await start(page)
  await roll(page, 6)
  await expect(page.getByRole('button', { name: /Joker 骰，显示骷髅面/ })).toHaveCount(6)
  await page.locator('button.dice-hit').first().click()
  await page.getByRole('button', { name: /黄金一点/ }).click()
  await expect(page.getByRole('button', { name: /骰子点数 1，Joker 骰，已选择/ })).toHaveCount(1)
  await page.getByRole('button', { name: /孤注一掷/ }).click()
  await expect(page.locator('button.dice-hit')).toHaveCount(0)
  await expect(page.locator('.turn-stats').getByText('200', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保存分数' }).click()
  await expect(page.locator('.score-card.human strong')).toHaveText('200')
})

test('missing Worker uses verified physics playback and reduced motion still resolves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    window.Worker = class { constructor() { throw new Error('Worker unavailable in test') } } as unknown as typeof Worker
  })
  await openGame(page)
  await start(page)
  await roll(page, 6)
  await expect(page.locator('.using-fallback')).toHaveCount(0)
  await page.locator('button.dice-hit').first().click()
  await page.getByRole('button', { name: '保存分数' }).click()
  await expect(page.locator('.score-card.human strong')).toHaveText('100')
})

test('WebGL unavailable keeps the whole game playable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null
      return original.apply(this, [type, ...args] as Parameters<typeof original>)
    } as typeof original
  })
  await openGame(page)
  await start(page)
  await expect(page.locator('.using-fallback')).toHaveCount(1)
  await page.getByRole('button', { name: /掷骰子/ }).click()
  await expect(page.getByRole('button', { name: /骰子点数 1，公平骰/ })).toHaveCount(6)
  await page.getByRole('button', { name: /骰子点数 1，公平骰/ }).first().click()
  await page.getByRole('button', { name: '保存分数' }).click()
  await expect(page.locator('.score-card.human strong')).toHaveText('100')
})

test('context loss during a roll releases the wait and retains its result', async ({ page }) => {
  await openGame(page)
  await start(page)
  await page.getByRole('button', { name: /掷骰子/ }).click()
  await page.locator('.scene-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
  })
  await expect(page.locator('.using-fallback')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /骰子点数 1，公平骰/ })).toHaveCount(6)
})

test('hidden-page pauses preserve the physical roll and require manual Continue', async ({ page }, info) => {
  await openGame(page)
  await start(page)
  await page.getByRole('button', { name: /掷骰子/ }).click()
  await expect(page.locator('.scene-hit-layer .dice-hit')).toHaveCount(6)
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
  await page.waitForTimeout(6500)
  await expect(page.locator('.game-shell')).toHaveClass(/phase-rolling/)
  await expect(page.locator('button.dice-hit')).toHaveCount(0)
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.locator('button.dice-hit')).toHaveCount(6)
  await page.locator('button.dice-hit').first().focus()
  await page.keyboard.press('Space')
  await page.screenshot({ path: info.outputPath('resumed.png') })
  await page.getByRole('button', { name: '保存分数' }).click()
  await expect(page.locator('.score-card.human strong')).toHaveText('100')
})

test('desktop layouts keep the table and controls in view', async ({ page }, info) => {
  await openGame(page)
  await start(page)
  for (const [width, height] of [[1280, 720], [1920, 1080], [2560, 1080]]) {
    await page.setViewportSize({ width, height })
    await expect(page.getByRole('button', { name: /掷骰子/ })).toBeInViewport()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(overflow).toBe(false)
    await page.screenshot({ path: info.outputPath(width + 'x' + height + '.png'), fullPage: true })
  }
})
