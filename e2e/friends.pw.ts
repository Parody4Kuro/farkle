import { equipItem } from './helpers/equipment'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
async function open(context: BrowserContext) {
  await context.addInitScript(() => {
    // Local transport acceptance uses real WebRTC without relying on public STUN availability.
    const peers: RTCPeerConnection[] = []
    ;(window as unknown as { testPeers: RTCPeerConnection[] }).testPeers = peers
    const Peer = window.RTCPeerConnection
    window.RTCPeerConnection = class extends Peer { constructor(config?: RTCConfiguration) { super({ ...config, iceServers: [] }); peers.push(this) } }
    const random = crypto.getRandomValues.bind(crypto)
    crypto.getRandomValues = ((array: ArrayBufferView) => {
      if (array instanceof Uint32Array && array.length === 1) { array[0] = 0; return array }
      return random(array)
    }) as typeof crypto.getRandomValues
  })
  const page = await context.newPage(); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/')
  await page.getByRole('button', { name: '好友对战', exact: true }).click()
  return page
}
async function resume(page: Page) {
  await page.bringToFront()
  const button = page.getByRole('button', { name: '继续', exact: true })
  if (await button.isVisible()) await button.click()
}
async function connect(host: Page, guest: Page, reconnect = false) {
  const old = reconnect ? await host.locator('#friend-output').inputValue() : ''
  await host.getByRole('button', { name: reconnect ? '生成新的重连邀请' : '创建对局并生成邀请', exact: true }).click()
  await expect(host.locator('#friend-output')).not.toHaveValue(old, { timeout: 20000 })
  const invite = await host.locator('#friend-output').inputValue()
  await guest.locator('#friend-input').fill(invite)
  await guest.getByRole('button', { name: '使用邀请，生成回应', exact: true }).click()
  await expect(guest.getByRole('button', { name: '使用邀请，生成回应', exact: true })).toBeEnabled({ timeout: 20000 })
  const response = await guest.locator('#friend-output').inputValue()
  await host.locator('#friend-input').fill(response)
  await host.getByRole('button', { name: '使用回应，连接朋友', exact: true }).click()
  await expect(host.locator('.friend-status')).toContainText('已直连')
  await expect(guest.locator('.friend-status')).toContainText('已直连')
}
test('real peer connection supports independent turns, background host, reconnection and rematch', async ({ browser }, info) => {
  test.setTimeout(120000)
  const a = await browser.newContext(), b = await browser.newContext()
  const errors: string[] = []
  try {
    const host = await open(a), guest = await open(b)
    host.on('pageerror', (e) => errors.push(e.message)); guest.on('pageerror', (e) => errors.push(e.message))
    await connect(host, guest)
    await host.getByRole('button', { name: '准备好了', exact: true }).click(); await guest.getByRole('button', { name: '准备好了', exact: true }).click()
    await expect(host.locator('.friend-dock')).toBeVisible(); await resume(host)
    await host.keyboard.press('f'); await expect(host.locator('button[data-die-id]')).toHaveCount(6)
    await host.keyboard.press('1'); await host.keyboard.down('q'); await host.waitForTimeout(450); await host.keyboard.up('q')
    await expect(host.locator('.friend-score').first()).toContainText('100')
    // Explicit blur tests the real visibility binding while the host retains authority.
    await host.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(host.getByText('你的画面已暂停', { exact: true })).toBeVisible()
    await resume(guest); await expect(guest.getByRole('button', { name: '掷骰子', exact: true })).toBeEnabled()
    await guest.keyboard.press('f'); await expect(guest.locator('button[data-die-id]')).toHaveCount(6)
    await guest.keyboard.press('1'); await guest.getByRole('button', { name: '保存分数', exact: true }).click()
    await expect(guest.locator('.friend-score > div').first()).toContainText('100')
    await expect(host.locator('.friend-score > div').last()).toContainText('100')
    await host.screenshot({ path: info.outputPath('background-host.png') })
    await host.evaluate(() => (window as unknown as { testPeers: RTCPeerConnection[] }).testPeers.at(-1)!.close())
    await expect(host.locator('.friend-status')).toContainText('已断线')
    await expect(guest.locator('.friend-status')).toContainText('已断线')
    await connect(host, guest, true)
    await expect(host.locator('.friend-score > div').last()).toContainText('100')
    await host.evaluate(() => window.dispatchEvent(new Event('focus')))
    await resume(host)
    await host.keyboard.press('f'); await expect(host.locator('button[data-die-id]')).toHaveCount(6)
    await host.keyboard.press('1'); await host.keyboard.press('2'); await host.keyboard.press('3'); await host.keyboard.press('4'); await host.keyboard.press('5'); await host.keyboard.press('6')
    await host.getByRole('button', { name: '保存分数', exact: true }).click()
    await expect(host.getByRole('heading', { name: '你赢了！' })).toBeVisible()
    await expect(guest.getByRole('heading', { name: '朋友赢了这一局。' })).toBeVisible()
    await guest.getByRole('button', { name: '再来一局 · 交换先手' }).click()
    await expect(host.getByText(/本局先手：朋友/)).toBeVisible()
    await host.getByLabel('好友玩法').selectOption('free')
    await expect(guest.getByLabel('好友玩法')).toHaveValue('free')
    await host.setViewportSize({ width: 1280, height: 720 }); await host.screenshot({ path: info.outputPath('free-loadout.png'), fullPage: true })
    await expect(host.getByRole('button', { name: '准备好了', exact: true })).toBeInViewport()
    await equipItem(host, 'badge', 0, 'core-steady')
    await equipItem(guest, 'badge', 0, 'core-kindred'); await equipItem(guest, 'badge', 1, 'loaded-hand')
    await host.getByRole('button', { name: '准备好了', exact: true }).click(); await guest.getByRole('button', { name: '准备好了', exact: true }).click()
    await expect(guest.locator('.friend-dock')).toBeVisible(); await resume(guest); await expect(guest.getByRole('button', { name: '掷骰子', exact: true })).toBeEnabled(); await guest.keyboard.press('f'); await expect(guest.locator('button[data-die-id]')).toHaveCount(7)
    await guest.keyboard.press('1'); await guest.keyboard.press('2'); await guest.keyboard.press('3')
    await guest.getByRole('button', { name: '保存分数', exact: true }).click()
    await expect(guest.locator('.friend-score > div').first()).toContainText('1500')
    await resume(host); await expect(host.getByRole('button', { name: '掷骰子', exact: true })).toBeEnabled(); await host.keyboard.press('f'); await expect(host.locator('button[data-die-id]')).toHaveCount(6)
    await host.keyboard.press('1'); await host.getByRole('button', { name: '保存分数', exact: true }).click()
    await expect(host.locator('.friend-score > div').first()).toContainText('200')
    expect(errors).toEqual([])
  } finally { await a.close(); await b.close() }
})
test('bad invitation displays a recoverable error without changing single-player saves', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '好友对战', exact: true }).click()
  await page.locator('#friend-input').fill('TB1.broken')
  await page.getByRole('button', { name: '使用邀请，生成回应', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('连接文本不完整')
  await page.getByRole('button', { name: '返回酒馆', exact: true }).click()
  await expect(page.getByRole('button', { name: '开始酒馆之夜', exact: true })).toBeVisible()
})
