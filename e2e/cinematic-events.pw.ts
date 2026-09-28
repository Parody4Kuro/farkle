import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pendingNight } from './helpers/adventureFixtures'
import { ADVENTURE_KEY, COMFORT_KEY, DEFAULT_COMFORT } from '../src/storage/adventureStorage'
import type { DieFace } from '../src/game/types'

test('records immersive seven-die Hot Dice, ability, bust and final bank without duplicate scoring', async ({ browser }, info) => {
  test.setTimeout(90000)
  const evidence = path.resolve('artifacts/realism'); await mkdir(evidence, { recursive:true })
  for (const event of ['hot', 'bust', 'victory'] as const) {
    const run = pendingNight(event === 'hot' ? 7 : 6, 'cinematic-' + event)
    if (event === 'hot') run.pendingDice = run.pendingDice.map((die, i) => ({ ...die, value: [1,1,1,5,5,5,1][i] as DieFace }))
    if (event === 'bust') { run.pendingDice = run.pendingDice.map((die, i) => ({ ...die, value:[2,3,4,2,3,4][i] as DieFace })); run.game.turnScore = 550 }
    if (event === 'victory') run.game.turnScore = 1950
    const context = await browser.newContext({ viewport:{width:1920,height:1080}, recordVideo:{dir:info.outputPath(event),size:{width:1920,height:1080}} })
    const page = await context.newPage(), errors:string[]=[]
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(({run,key,prefs,comfort}) => {if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:2,run,runtime:{paused:true}}));localStorage.setItem(prefs,JSON.stringify(comfort))}, {run,key:ADVENTURE_KEY,prefs:COMFORT_KEY,comfort:{...DEFAULT_COMFORT,dialogue:false}})
    await page.goto('/');await page.getByRole('button',{name:/^继续这一夜/}).click();await page.getByRole('button',{name:'继续',exact:true}).click()
    if (event === 'bust') {
      await expect(page.locator('[data-presentation-active="bust"]')).toBeVisible()
      await page.waitForTimeout(600);await page.screenshot({path:path.join(evidence,'bust-reaction.png')})
      await expect(page.locator('[data-presentation-active="bust"]')).toHaveCount(0)
      const saved=await page.evaluate((key)=>JSON.parse(localStorage.getItem(key)!).run,ADVENTURE_KEY)
      expect(saved.game.turnScore).toBe(0);expect(saved.game.scores.human).toBe(0)
    } else {
      await expect(page.locator('button[data-die-id]')).toHaveCount(event === 'hot' ? 7 : 6)
      if (event === 'hot') {
        await page.locator('button[data-die-id]').nth(3).click()
        await page.getByRole('button',{name:/黄金一点 · 剩余/}).click()
        await expect(page.locator('[data-presentation-active="ability"]')).toBeVisible()
        await page.waitForTimeout(300);await page.screenshot({path:path.join(evidence,'ability-flip.png')})
        await expect(page.locator('[data-presentation-active="ability"]')).toHaveCount(0)
        const unselected = page.locator('button[data-die-id][aria-pressed="false"]')
        while (await unselected.count()) await unselected.first().click()
        await page.getByRole('button',{name:'锁定并继续掷骰',exact:true}).click()
        await expect(page.locator('[data-presentation-active="hot"]')).toBeVisible()
        await page.waitForTimeout(450);await page.screenshot({path:path.join(evidence,'hot-dice.png')})
        await expect(page.locator('[data-presentation-active="roll"]')).toBeVisible()
        await expect(page.locator('[data-presentation-active="roll"]')).toHaveCount(0,{timeout:10000})
      } else {
        await page.locator('button[data-die-id]').first().click()
        await page.getByRole('button',{name:'保存分数',exact:true}).click()
        await expect(page.locator('[data-presentation-active="victory"]')).toBeVisible()
        await expect(page.getByRole('heading',{name:'赢来的，选一件带走。'})).toHaveCount(0)
        await page.waitForTimeout(1750)
        await expect(page.locator('[data-score-player="human"][data-score-field="total"]')).toHaveText('2,050')
        await page.screenshot({path:path.join(evidence,'victory-reaction.png')})
        await expect(page.getByRole('heading',{name:'赢来的，选一件带走。'})).toBeVisible()
        const saved=await page.evaluate((key)=>JSON.parse(localStorage.getItem(key)!).run,ADVENTURE_KEY)
        expect(saved.game.scores.human).toBe(2050);expect(saved.history).toHaveLength(1)
        await page.reload();await page.getByRole('button',{name:/^继续这一夜/}).click()
        expect(await page.evaluate((key)=>JSON.parse(localStorage.getItem(key)!).run.history.length,ADVENTURE_KEY)).toBe(1)
      }
    }
    expect(errors).toEqual([])
    const video=page.video()!;await context.close();await video.saveAs(path.join(evidence,`${event}-sequence.webm`))
  }
})
