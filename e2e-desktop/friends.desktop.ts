/* oxlint-disable no-empty-pattern -- Playwright fixtures. */
import { test, expect, _electron, chromium, type Page } from '@playwright/test'
import path from 'node:path'

test('packaged Mac and browser connect with default STUN and host keeps processing while minimized', async ({}, info) => {
  test.setTimeout(120000)
  const app = await _electron.launch({ executablePath: path.resolve('release/mac-arm64/Tavern Bones.app/Contents/MacOS/Tavern Bones'), env: {
    ...Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE')) as Record<string,string>,
    TAVERN_BONES_DATA_DIR: info.outputPath('data'),
  } })
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const host = await app.firstWindow(), guest = await browser.newPage()
    const errors: string[] = []
    host.on('pageerror', (e) => errors.push(e.message)); guest.on('pageerror', (e) => errors.push(e.message))
    await guest.goto('http://127.0.0.1:4174/')
    const deterministic = async (page: Page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.evaluate(() => {
        const random = crypto.getRandomValues.bind(crypto)
        crypto.getRandomValues = ((array: ArrayBufferView) => { if (array instanceof Uint32Array && array.length === 1) { array[0] = 0; return array } return random(array) }) as typeof crypto.getRandomValues
      })
    }
    await deterministic(host); await deterministic(guest)
    await app.evaluate(({ app, BrowserWindow }) => { app.focus({ steal: true }); BrowserWindow.getAllWindows()[0].focus() })
    await host.getByRole('button', { name: '好友对战', exact: true }).click(); await guest.getByRole('button', { name: '好友对战', exact: true }).click()
    await host.getByRole('button', { name: '创建对局并生成邀请', exact: true }).click()
    await expect(host.locator('#friend-output')).toHaveValue(/^TB1\./, { timeout: 20000 })
    await guest.locator('#friend-input').fill(await host.locator('#friend-output').inputValue())
    await guest.getByRole('button', { name: '使用邀请，生成回应', exact: true }).click()
    await expect(guest.locator('#friend-output')).toHaveValue(/^TB1\./, { timeout: 20000 })
    await host.locator('#friend-input').fill(await guest.locator('#friend-output').inputValue())
    await host.getByRole('button', { name: '使用回应，连接朋友', exact: true }).click()
    await expect(host.locator('.friend-status')).toContainText('已直连', { timeout: 35000 }); await expect(guest.locator('.friend-status')).toContainText('已直连')
    await host.getByRole('button', { name: '准备好了', exact: true }).click(); await guest.getByRole('button', { name: '准备好了', exact: true }).click()
    await app.evaluate(({ app, BrowserWindow }) => { app.focus({ steal: true }); BrowserWindow.getAllWindows()[0].focus() })
    if (await host.getByRole('button', { name: '继续', exact: true }).isVisible()) await host.getByRole('button', { name: '继续', exact: true }).click()
    await host.getByRole('button', { name: '掷骰子', exact: true }).click(); await expect(host.locator('button[data-die-id]')).toHaveCount(6)
    await host.keyboard.press('1'); await host.getByRole('button', { name: '保存分数', exact: true }).click()
    await app.browserWindow(host).then((window) => window.evaluate((window) => window.minimize()))
    await expect(host.getByText('你的画面已暂停', { exact: true })).toBeVisible()
    if (await guest.getByRole('button', { name: '继续', exact: true }).isVisible()) await guest.getByRole('button', { name: '继续', exact: true }).click()
    await guest.getByRole('button', { name: '掷骰子', exact: true }).click(); await expect(guest.locator('button[data-die-id]')).toHaveCount(6)
    await guest.keyboard.press('1'); await guest.getByRole('button', { name: '保存分数', exact: true }).click()
    await expect(host.locator('.friend-score > div').last()).toContainText('100')
    await app.browserWindow(host).then((window) => window.evaluate((window) => { window.restore(); window.show(); window.focus() }))
    await host.getByRole('button', { name: '继续', exact: true }).click()
    await expect(host.getByRole('button', { name: '掷骰子', exact: true })).toBeEnabled()
    await host.screenshot({ path: info.outputPath('mac-browser-friends.png') })
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()?.sandbox)).toBe(true)
    expect(errors).toEqual([])
  } finally { await app.close(); await browser.close() }
})
