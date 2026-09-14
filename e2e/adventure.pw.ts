import { test, expect, type Locator, type Page } from '@playwright/test'
import { adventureReducer, createAdventure, type AdventureRun } from '../src/game/adventure'
import { ADVENTURE_KEY, COMFORT_KEY, LEGACY_ADVENTURE_KEY } from '../src/storage/adventureStorage'
import { COMPLETE_NIGHT_SEED, playCompleteNight } from './helpers/completeNight'
import { pendingNight as pending, openedNight } from './helpers/adventureFixtures'
import { addInventoryItem } from '../src/game/inventory'
import { DIE_DEFINITIONS } from '../src/game/dice'

async function openNight(page: Page, run?: AdventureRun) {
  await page.addInitScript(({ run, key, comfortKey }) => {
    if (run && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 2, run, runtime: { paused: true } }))
    localStorage.setItem(comfortKey, JSON.stringify({ fast: true, dialogue: true, environment: 0, music: 0 }))
  }, { run, key: ADVENTURE_KEY, comfortKey: COMFORT_KEY })
  await page.goto('/')
  if (run) await page.getByRole('button', { name: /^继续这一夜/ }).click()
  else await page.getByRole('button', { name: '开始酒馆之夜', exact: true }).click()
  if (run?.stage === 'playing') await page.getByRole('button', { name: '继续', exact: true }).click()
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
  await page.getByRole('button', { name: '继续', exact: true }).click()
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

test('victory rewards enter the bag once and can be equipped without discarding the replaced die', async ({ page }) => {
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
  await page.getByRole('button', { name: /^收入行囊/ }).click()
  await expect(page.getByRole('heading', { name: '炉火桌，有人等你。' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^继续这一夜/ }).click()
  await expect(page.locator('.inventory-summary')).toContainText('7 颗骰子')
  await page.getByRole('combobox', { name: /^骰子 1/ }).selectOption(DIE_DEFINITIONS.find((d) => d.name === rewardName)!.id)
  await page.getByRole('button', { name: '入座，开始这一桌', exact: true }).click()
  await page.getByRole('button', { name: '掷骰子', exact: true }).click()
  await expect(page.locator('button.dice-hit').filter({ has: page.locator('span') })).toHaveCount(6)
  await expect(page.locator('button.dice-hit').first()).toHaveAttribute('aria-label', new RegExp(rewardName))
})

test('a third badge is retained in the bag and can replace an equipped badge before entry', async ({ page }) => {
  const run = pending()
  run.stage = 'reward'; run.flow = 'done'; run.pendingDice = []; run.game.phase = 'game_over'; run.game.winner = 'human'
  run.modifiers = ['loaded-hand', 'golden-one']
  run.inventory = addInventoryItem(addInventoryItem(run.inventory, 'modifier', 'loaded-hand'), 'modifier', 'golden-one')
  run.rewardOfferId = 'badge-offer'
  run.game.config.modifierIds = [...run.modifiers]
  run.rewards = [{ id: 'charm', kind: 'modifier', definitionId: 'lucky-charm' }, { id: 'joker', kind: 'die', definitionId: 'joker' }, { id: 'double', kind: 'modifier', definitionId: 'double-down' }]
  await openNight(page, run)
  await page.locator('.loot-card').filter({ hasText: '幸运护符' }).click()
  await page.getByRole('button', { name: /^收入行囊/ }).click()
  await expect(page.locator('.inventory-summary')).toContainText('4 枚徽章')
  await page.getByRole('combobox', { name: /^徽章 2/ }).selectOption('lucky-charm')
  await page.getByRole('button', { name: '入座，开始这一桌', exact: true }).click()
  await expect(page.locator('.night-footer')).toContainText('徽章 2 / 2')
})

test('first boss loss offers one retry with a fresh 4000-point match', async ({ page }) => {
  let run = { ...openedNight(52, 'boss-retry'), table: 3 }
  run = adventureReducer(run, { type: 'SIT' })
  run = { ...run, flow: 'decide', game: { ...run.game, phase: 'ai_thinking', currentPlayer: 'ai', turnScore: 3950,
    rolledDice: [{ id: 'boss1', definitionId: 'standard', value: 1, selected: true }] } }
  await openNight(page, run)
  await expect(page.getByRole('heading', { name: '整理行囊，再战这一桌。' })).toBeVisible()
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
  await openNight(page, createAdventure(COMPLETE_NIGHT_SEED, 'complete-night'))
  await playCompleteNight(page)
})

async function tabTo(page: Page, target: Locator) {
  // macOS WebKit reserves plain Tab for form fields; Option-Tab includes buttons.
  const option = test.info().project.name === 'webkit' && process.platform === 'darwin' ? 'Alt+' : ''
  for (let i = 0; i < 60; i++) {
    const focus = await target.evaluate((element) => ({ reached: element === document.activeElement,
      backwards: document.activeElement !== document.body && !!((document.activeElement?.compareDocumentPosition(element) ?? 0) & Node.DOCUMENT_POSITION_PRECEDING) }))
    if (focus.reached) return
    await page.keyboard.press(option + (focus.backwards ? 'Shift+Tab' : 'Tab'))
  }
  throw new Error('Target was not reachable with Tab')
}

test('keyboard-only route covers opening core, equipment, selection, reward, pause and Continue', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const run = createAdventure(33, 'keyboard-night')
  await page.addInitScript(({ key, comfortKey, run }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, run, runtime: { paused: false } }))
    localStorage.setItem(comfortKey, JSON.stringify({ fast: true, environment: 0, music: 0 }))
  }, { key: ADVENTURE_KEY, comfortKey: COMFORT_KEY, run })
  await page.goto('/')
  await tabTo(page, page.getByRole('button', { name: /^继续这一夜/ }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '今夜，按你的打法来。' })).toBeVisible()
  await tabTo(page, page.getByRole('button', { name: '选择同契纹章', exact: true }))
  await page.keyboard.press('Enter')
  const badge = page.getByRole('combobox', { name: /^徽章 1/ })
  await tabTo(page, badge)
  await page.keyboard.press('0')
  await expect(badge).toHaveValue('')
  await tabTo(page, page.getByRole('combobox', { name: /^徽章 2/ }))
  await tabTo(page, badge)
  // WebKit keeps native select typeahead across blur; wait for its search prefix
  // to expire so this is a new "1" choice, not a search for "01".
  if (info.project.name === 'webkit') await page.waitForTimeout(1500)
  await page.keyboard.press('1')
  await expect(badge).toHaveValue('core-kindred')
  await tabTo(page, page.getByRole('button', { name: '入座，开始这一桌', exact: true }))
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('button', { name: '掷骰子', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.locator('button.dice-hit')).toHaveCount(6)
  for (const die of await page.getByRole('button', { name: /^骰子点数 1，/ }).all()) {
    await tabTo(page, die)
    await page.keyboard.press('Space')
  }
  await expect(page.getByLabel('计分明细')).toContainText('可落袋 3000')
  await tabTo(page, page.getByRole('button', { name: '保存分数', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '赢来的，选一件带走。' })).toBeVisible()
  const reward = page.locator('.loot-card').filter({ hasText: '一颗特殊骰' }).first()
  const rewardName = await reward.locator('strong').innerText()
  await tabTo(page, reward)
  await page.keyboard.press('Space')
  await tabTo(page, page.getByRole('button', { name: /^收入行囊/ }))
  await page.keyboard.press('Enter')
  const slot = page.getByRole('combobox', { name: /^骰子 1/ })
  await tabTo(page, slot)
  await page.keyboard.press('2')
  await expect(slot).toHaveValue(DIE_DEFINITIONS.find((d) => d.name === rewardName)!.id)
  await tabTo(page, page.getByRole('button', { name: '入座，开始这一桌', exact: true }))
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('button', { name: '暂停对局' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('keyboard-pause.png') })
  await tabTo(page, page.getByRole('button', { name: '继续', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '掷骰子', exact: true })).toBeEnabled()
})

test('a physical roll keeps its pose, result and timeout while paused, then survives context loss', async ({ page }) => {
  const run = pending(7)
  await page.addInitScript(({ key, comfortKey, run }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, run, runtime: { paused: true } }))
    localStorage.setItem(comfortKey, JSON.stringify({ fast: false, environment: 0, music: 0 }))
  }, { key: ADVENTURE_KEY, comfortKey: COMFORT_KEY, run })
  await page.goto('/')
  await page.getByRole('button', { name: /^继续这一夜/ }).click()
  await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.locator('.scene-hit-layer .dice-hit')).toHaveCount(7)
  await page.getByRole('button', { name: '暂停对局' }).click()
  const pose = await page.locator('.scene-hit-layer .dice-hit').evaluateAll((els) => els.map((el) => el.getAttribute('style')))
  const snapshot = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY)
  await page.waitForTimeout(6500)
  expect(await page.locator('.scene-hit-layer .dice-hit').evaluateAll((els) => els.map((el) => el.getAttribute('style')))).toEqual(pose)
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY)).toEqual(snapshot)
  await page.locator('.scene-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
  })
  await expect(page.locator('.using-fallback')).toHaveCount(1)
  await expect(page.locator('.night-shell')).toHaveAttribute('data-flow', 'rolling')
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.getByRole('button', { name: /骰子点数 1，公平骰/ })).toHaveCount(4)
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY)
  expect(saved.rng).toBe(run.rng)
  expect(saved.game.rolledDice).toEqual(run.pendingDice)
})

test('a first ordinary loss retries the same opponent with all gear and no reward', async ({ page }) => {
  let run = adventureReducer(openedNight(41, 'ordinary-retry'), { type: 'SIT' })
  run = { ...run, flow: 'decide', game: { ...run.game, phase: 'ai_thinking', currentPlayer: 'ai', turnScore: 1950,
    rolledDice: [{ id: 'one', definitionId: 'standard', value: 1, selected: true }] } }
  await openNight(page, run)
  await expect(page.getByRole('heading', { name: '整理行囊，再战这一桌。' })).toBeVisible()
  await expect(page.locator('.encounter-panel')).toContainText('玛拉')
  await expect(page.locator('.loot-card')).toHaveCount(0)
  await expect(page.locator('.inventory-summary')).toContainText('6 颗骰子、1 枚徽章')
  await page.getByRole('combobox', { name: /^徽章 1/ }).selectOption('core-steady')
  await page.getByRole('button', { name: '入座，开始这一桌', exact: true }).click()
  await expect(page.locator('.night-scoreband > div').first().locator('strong')).toHaveText('0')
  await expect(page.locator('.night-scoreband > div').last().locator('strong')).toHaveText('0')
  await expect(page.locator('.night-target')).toContainText('2,000')
})

test('legacy pending rolls migrate once and resume without an opening core grant', async ({ page }) => {
  const modern = pending(7)
  const old = { ...modern, version: 1, inventory: undefined, opening: undefined, rewardOfferId: undefined, scoringVersion: undefined,
    game: { ...modern.game, config: { ...modern.game.config, scoringVersion: undefined } } }
  await page.addInitScript(({ key, old }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(old)) }, { key: LEGACY_ADVENTURE_KEY, old })
  await page.goto('/')
  await page.getByRole('button', { name: /^继续这一夜/ }).click()
  await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.locator('button.dice-hit')).toHaveCount(7)
  const saved = await page.evaluate(({ key, legacy }) => ({ run: JSON.parse(localStorage.getItem(key)!).run, old: localStorage.getItem(legacy) }), { key: ADVENTURE_KEY, legacy: LEGACY_ADVENTURE_KEY })
  expect(saved.run.inventory.modifiers).toEqual(['loaded-hand', 'golden-one'])
  expect(saved.run.opening.source).toBe('migrated')
  expect(saved.run.rng).toBe(old.rng)
  expect(saved.old).toBe(JSON.stringify(old))
})
