import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { adventureReducer } from '../src/game/adventure'
import { openedNight, pendingNight } from './helpers/adventureFixtures'
import { ADVENTURE_KEY, COMFORT_KEY, DEFAULT_COMFORT } from '../src/storage/adventureStorage'
import { calculateBestScore } from '../src/game/scoring'
import type { DiceValue } from '../src/game/types'
import { beginFrameProbe, readFrameProbe } from './helpers/frameProbe'

const evidence = path.resolve('artifacts/realism')
async function enter(page: Page, table = 0, fixture = false) {
  const run = fixture ? pendingNight() : adventureReducer({ ...openedNight(57, 'realism-demo-' + table), table }, { type: 'SIT' })
  await page.addInitScript(({ run, key, prefs, comfort }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 2, run, runtime: { paused: true } })); localStorage.setItem(prefs, JSON.stringify(comfort)) }, { run, key: ADVENTURE_KEY, prefs: COMFORT_KEY, comfort: { ...DEFAULT_COMFORT, dialogue: false } })
  await page.goto('/'); await page.getByRole('button', { name: /^继续这一夜/ }).click(); await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.locator('.tavern-scene[data-art="realistic"] canvas')).toBeVisible()
  await expect(page.locator('.using-fallback')).toHaveCount(0)
}
async function selectBest(page: Page) {
  const buttons = page.locator('button[data-die-id]')
  const values = await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.includes('骷髅') ? 'JOKER' : Number(e.getAttribute('aria-label')!.match(/点数 (\d)/)![1]))) as DiceValue[]
  const best = calculateBestScore(values)
  for (const i of values.map((_, i) => i).filter((i) => !best.unusedIndices.includes(i))) await buttons.nth(i).click()
}

test('immersive first-table recording, readable layouts and measured frame pacing', async ({ browser }, info) => {
  test.setTimeout(90000); await mkdir(evidence, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: info.outputPath('video'), size: { width: 1920, height: 1080 } } })
  const page = await context.newPage(), errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await enter(page)
  await page.getByRole('button', { name: '看向对手', exact: true }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(evidence, 'mara-1080.png') })
  await page.getByRole('button', { name: '俯身看骰', exact: true }).click()
  const began = Date.now()
  await beginFrameProbe(page)
  await page.getByRole('button', { name: '掷骰子', exact: true }).click()
  await expect(page.locator('[data-presentation-active="roll"]')).toBeVisible()
  await page.waitForTimeout(650)
  await page.screenshot({ path: path.join(evidence, 'cup-contact.png') })
  await expect(page.locator('button[data-die-id]')).toHaveCount(6)
  const rollMs = Date.now() - began
  const fullRollFrames = await readFrameProbe(page)
  const render = await page.locator('canvas').evaluate((c) => ({ ...c.dataset }))
  const heap = await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize)
  for (const [width, height] of [[1280,720],[1920,1080],[2560,1080]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(150)
    await expect(page.getByRole('button', { name: '保存分数', exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    const rects = await page.locator('button[data-die-id]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height } }))
    expect(rects.every((r) => r.left >= 0 && r.right <= width && r.top >= 0 && r.bottom < height && r.width >= 42 && r.height >= 42)).toBe(true)
    await page.screenshot({ path: path.join(evidence, `table-${width}.png`) })
  }
  await page.setViewportSize({ width:1920, height:1080 })
  await page.locator('button[data-die-id]').first().click()
  await page.getByRole('button', { name:'锁定并继续掷骰', exact:true }).click()
  await expect(page.locator('[data-presentation-active="collect"]')).toBeVisible()
  await page.waitForTimeout(460); await page.screenshot({ path: path.join(evidence, 'collect-contact.png') })
  await expect(page.locator('button[data-die-id]')).toHaveCount(5, { timeout:15000 })
  await selectBest(page)
  await page.getByRole('button', { name:'保存分数', exact:true }).click()
  await expect(page.locator('[data-presentation-active="bank"]')).toBeVisible()
  await page.waitForTimeout(950); await page.screenshot({ path: path.join(evidence, 'bank-credit.png') })
  await expect(page.getByRole('button', { name:'掷骰子', exact:true })).toBeEnabled({timeout:20000})
  const video = page.video()!
  expect(errors).toEqual([])
  await writeFile(path.join(evidence,'browser-metrics.json'), JSON.stringify({ browser:info.project.name, viewport:'1920x1080', rollMs, fullRollFrames, render, jsHeapBytes:heap, errors, capturedAt:new Date().toISOString() },null,2)+'\n')
  await context.close(); await video.saveAs(path.join(evidence,'first-table.webm'))
})

test('all four character exports load independently and remain playable', async ({ browser }) => {
  test.setTimeout(45000); await mkdir(evidence,{recursive:true})
  for (const [table, id] of ['mara','osric','rue','keeper'].entries()) {
    const context=await browser.newContext({ viewport:{width:1920,height:1080} }), page=await context.newPage()
    await enter(page,table); await page.getByRole('button',{name:'看向对手',exact:true}).click(); await page.waitForTimeout(1000)
    await page.screenshot({ path:path.join(evidence,`${id}-portrait.png`) })
    await expect(page.locator('.using-fallback')).toHaveCount(0); await context.close()
  }
})

test('bank pause, skip and reload never credit twice; a missing model remains playable', async ({ page }) => {
  await enter(page,0,true)
  await expect(page.locator('button[data-die-id]')).toHaveCount(6)
  await page.locator('button[data-die-id]').first().click(); await page.getByRole('button',{name:'保存分数',exact:true}).click()
  await expect(page.locator('[data-presentation-active="bank"]')).toBeVisible()
  await page.getByRole('button',{name:'暂停对局',exact:true}).click(); await page.waitForTimeout(1900)
  await expect(page.locator('[data-presentation-active="bank"]')).toBeVisible()
  await page.getByRole('button',{name:'继续',exact:true}).click(); await page.getByRole('button',{name:'跳过本次演出',exact:true}).click()
  await expect(page.locator('[data-score-player="human"][data-score-field="total"]')).toHaveText('100')
  await page.reload(); await page.getByRole('button',{name:/^继续这一夜/}).click(); await page.getByRole('button',{name:'继续',exact:true}).click()
  await expect(page.locator('[data-score-player="human"][data-score-field="total"]')).toHaveText('100')
  await page.route('**/art/characters/*.glb', (route) => route.abort())
  await page.reload(); await page.getByRole('button',{name:/^继续这一夜/}).click(); await page.getByRole('button',{name:'继续',exact:true}).click()
  await expect(page.locator('.using-fallback')).toHaveCount(1)
})
