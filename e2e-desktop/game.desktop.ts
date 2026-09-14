/* oxlint-disable no-empty-pattern -- Playwright requires a destructured fixture argument; these tests launch Electron instead of a browser fixture. */
import { test, expect, _electron, type ElectronApplication, type Page, type TestInfo } from '@playwright/test'
import { spawn } from 'node:child_process'
import { appendFile, cp, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { adventureReducer, createAdventure, type AdventureRun } from '../src/game/adventure'
import { ADVENTURE_KEY, COMFORT_KEY, DEFAULT_COMFORT, PROFILE_KEY } from '../src/storage/adventureStorage'
import { COMPLETE_NIGHT_SEED, playCompleteNight } from '../e2e/helpers/completeNight'
import { openedNight, pendingNight } from '../e2e/helpers/adventureFixtures'

const bundle = path.resolve('release/mac-arm64/Tavern Bones.app')
const executable = (directory = bundle) => path.join(directory, 'Contents/MacOS/Tavern Bones')
const environment = (directory: string) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE')) as Record<string, string>,
  TAVERN_BONES_DATA_DIR: directory,
})

interface Diagnostics { workers: string[]; frames: number[]; audio: AudioContext[] }
declare global { interface Window { __tavernDiagnostics: Diagnostics } }

async function activate(app: ElectronApplication, page: Page) {
  // Protocol mouse events can reach an inactive Mac app without activating it.
  // Reproduce bringing the actual app forward, then let the UI require Continue.
  await app.evaluate(({ app, BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window.isFocused()) { app.focus({ steal: true }); window.show(); window.focus(); window.webContents.focus() }
  })
  await expect.poll(() => page.evaluate(() => window.tavernDesktop?.isFocused?.())).toBe(true)
}

async function playUntil(app: ElectronApplication, page: Page, ready: () => Promise<boolean>) {
  await expect.poll(async () => {
    await activate(app, page)
    const resume = page.getByRole('button', { name: '继续', exact: true })
    if (await resume.isVisible()) await resume.click()
    return ready()
  }, { timeout: 20000 }).toBe(true)
}

async function resumeForeground(app: ElectronApplication, page: Page) {
  await activate(app, page)
  const button = page.getByRole('button', { name: '继续', exact: true })
  if (await button.isVisible()) await button.click()
}

async function launch(directory: string, info: TestInfo, appBundle = bundle) {
  const start = performance.now()
  const app = await _electron.launch({ executablePath: executable(appBundle), env: environment(directory), timeout: 30000 })
  try {
    const page = await app.firstWindow()
    await app.context().setOffline(true)
    await expect(page.getByRole('heading', { name: /TAVERN.*BONES/ })).toBeVisible()
    await activate(app, page)
    const startup = JSON.stringify({ lobbyVisibleMs: Math.round(performance.now() - start), bundle: appBundle })
    await appendFile(info.outputPath('startup.jsonl'), startup + '\n')
    await info.attach('startup', { body: startup, contentType: 'application/json' })
    return { app, page }
  } catch (error) { await close(app); throw error }
}

async function seed(app: ElectronApplication, page: Page, run: AdventureRun, fast = true, resume = true) {
  await activate(app, page)
  // Unmount the live run first: reloading it emits a real blur and persists its
  // pause checkpoint, which must not overwrite the next test fixture.
  if (await page.locator('.night-shell').count()) {
    const pauseHome = page.getByRole('button', { name: '返回酒馆', exact: true })
    if (await pauseHome.isVisible()) await pauseHome.click()
    else await page.getByRole('button', { name: '保存并返回酒馆', exact: true }).click()
    await expect(page.getByRole('heading', { name: /TAVERN.*BONES/ })).toBeVisible()
  }
  await page.evaluate(({ run, key, comfortKey, comfort }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, run, runtime: { paused: true } }))
    localStorage.setItem(comfortKey, JSON.stringify(comfort))
  }, { run, key: ADVENTURE_KEY, comfortKey: COMFORT_KEY, comfort: { ...DEFAULT_COMFORT, fast } })
  await page.reload()
  await activate(app, page)
  await page.getByRole('button', { name: /^继续这一夜/ }).click()
  if (resume && run.stage === 'playing') await page.getByRole('button', { name: '继续', exact: true }).click()
}

const pending = (count = 7) => pendingNight(count, 'desktop-pending')

async function diagnostics(page: Page) {
  await page.addInitScript(() => {
    window.__tavernDiagnostics = { workers: [], frames: [], audio: [] }
    const OriginalWorker = window.Worker
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        window.__tavernDiagnostics.workers.push(String(url))
        this.addEventListener('message', (event) => {
          if (event.data.trajectory?.frames?.length) window.__tavernDiagnostics.frames.push(event.data.trajectory.frames.length)
        })
      }
    }
    const OriginalAudioContext = window.AudioContext
    window.AudioContext = class extends OriginalAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        window.__tavernDiagnostics.audio.push(this)
      }
    }
  })
  await page.reload()
}

async function close(app: ElectronApplication) {
  if (app.process().exitCode === null) await app.close()
}

test('packaged offline app runs WebGL, a real physics Worker, seven dice, keyboard input and audio', async ({}, info) => {
  const { app, page } = await launch(info.outputPath('data'), info)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await diagnostics(page)
    expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true)
    expect(page.url()).toBe('tavern://game/')
    expect(await page.evaluate(() => ({ secure: isSecureContext, node: typeof (window as unknown as { require?: unknown }).require })))
      .toEqual({ secure: true, node: 'undefined' })
    const preferences = await app.browserWindow(page).then((window) => window.evaluate((window) => window.webContents.getLastWebPreferences()))
    expect(preferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true })
    expect(await page.evaluate(() => window.__tavernDiagnostics.audio.length)).toBe(0)
    await expect.poll(() => page.evaluate(() => window.__tavernDiagnostics.frames.length)).toBeGreaterThan(0)
    await seed(app, page, pending())
    await expect(page.locator('button.dice-hit')).toHaveCount(7)
    await expect(page.locator('.using-fallback')).toHaveCount(0)
    expect(await page.locator('.scene-canvas canvas').evaluate((canvas: HTMLCanvasElement) => Boolean(canvas.getContext('webgl2')))).toBe(true)
    await expect.poll(() => page.evaluate(() => window.__tavernDiagnostics.frames.length)).toBeGreaterThan(0)
    await page.locator('button.dice-hit').first().focus()
    await page.keyboard.press('Space')
    await expect(page.getByLabel('计分明细')).toContainText('可落袋 100')
    await expect.poll(() => page.evaluate(() => window.__tavernDiagnostics.audio.some((context) => context.state === 'running'))).toBe(true)
    await page.screenshot({ path: info.outputPath('seven-dice.png') })
    const nativeWindow = await app.browserWindow(page)
    await nativeWindow.evaluate((window) => window.minimize())
    await expect.poll(() => nativeWindow.evaluate((window) => window.isMinimized())).toBe(true)
    await expect.poll(() => page.evaluate(() => window.tavernDesktop?.isVisible())).toBe(false)
    await expect.poll(() => page.evaluate(() => window.__tavernDiagnostics.audio.every((context) => context.state !== 'running'))).toBe(true)
    await nativeWindow.evaluate((window) => { window.restore(); window.show(); window.focus() })
    await expect.poll(() => page.evaluate(() => window.tavernDesktop?.isVisible())).toBe(true)
    await activate(app, page)
    await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
    expect(await page.evaluate(() => window.__tavernDiagnostics.audio.every((context) => context.state !== 'running'))).toBe(true)
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__tavernDiagnostics.audio.some((context) => context.state === 'running'))).toBe(true)
    await nativeWindow.evaluate((window) => window.setFullScreen(true))
    await expect.poll(() => nativeWindow.evaluate((window) => window.isFullScreen())).toBe(true)
    await expect(page.getByRole('button', { name: '保存分数', exact: true })).toBeInViewport()
    await nativeWindow.evaluate((window) => window.setFullScreen(false))
    await expect.poll(() => nativeWindow.evaluate((window) => window.isFullScreen())).toBe(false)
    await resumeForeground(app, page)
    await page.getByRole('button', { name: '保存分数', exact: true }).click()
    await expect(page.locator('.night-scoreband > div').first()).toContainText('100')
    expect(errors).toEqual([])
  } finally { await close(app) }
})

test('quitting during a pending physical roll restores the sampled result and selection', async ({}, info) => {
  const directory = info.outputPath('data')
  let { app, page } = await launch(directory, info)
  try {
    const initial = pending()
    await seed(app, page, initial, false)
    await expect(page.locator('.night-shell')).toHaveAttribute('data-flow', 'rolling')
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY) as AdventureRun
    expect(saved.pendingDice).toEqual(initial.pendingDice)
    await close(app)
    ;({ app, page } = await launch(directory, info))
    await page.getByRole('button', { name: /^继续这一夜/ }).click()
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect(page.locator('button.dice-hit')).toHaveCount(7)
    const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY) as AdventureRun
    expect(restored.rng).toBe(initial.rng)
    expect(restored.game.rolledDice).toEqual(initial.pendingDice)
    await page.locator('button.dice-hit').first().click()
    await close(app)
    ;({ app, page } = await launch(directory, info))
    await page.getByRole('button', { name: /^继续这一夜/ }).click()
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect(page.locator('button.dice-hit').first()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('计分明细')).toContainText('可落袋 100')
  } finally { await close(app) }
})

test('an interrupted AI bank finishes once and a pending reward survives quitting', async ({}, info) => {
  const directory = info.outputPath('data')
  let { app, page } = await launch(directory, info)
  try {
    const base = adventureReducer(openedNight(14, 'desktop-ai'), { type: 'SIT' })
    const ai: AdventureRun = { ...base, flow: 'decide', game: { ...base.game, currentPlayer: 'ai', phase: 'ai_thinking', turnScore: 400,
      rolledDice: [{ id: 'ai-one', definitionId: 'standard', value: 1, selected: true }, { id: 'ai-two', definitionId: 'standard', value: 2, selected: false }] } }
    // Exit from the lobby with the interrupted snapshot; opening the game resumes its decision.
    await page.evaluate(({ key, run }) => localStorage.setItem(key, JSON.stringify({ version: 2, run, runtime: { paused: true } })), { key: ADVENTURE_KEY, run: ai })
    await close(app)
    ;({ app, page } = await launch(directory, info))
    await page.getByRole('button', { name: /^继续这一夜/ }).click()
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await playUntil(app, page, async () => {
      const button = page.getByRole('button', { name: '掷骰子', exact: true })
      return await button.isVisible() && await button.isEnabled()
    })
    await expect(page.locator('.night-scoreband > div').last()).toContainText('500')
    await close(app)
    ;({ app, page } = await launch(directory, info))
    await page.getByRole('button', { name: /^继续这一夜/ }).click()
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect(page.locator('.night-scoreband > div').last()).toContainText('500')
    const winning = pending(6)
    winning.game.turnScore = 1950
    await seed(app, page, winning)
    await playUntil(app, page, async () => await page.locator('button.dice-hit').count() === 6)
    await page.locator('button.dice-hit').first().click()
    await page.getByRole('button', { name: '保存分数', exact: true }).click()
    await expect(page.locator('.loot-card')).toHaveCount(3)
    const rewards = await page.locator('.loot-card strong').allTextContents()
    await close(app)
    ;({ app, page } = await launch(directory, info))
    await page.getByRole('button', { name: /^继续这一夜/ }).click()
    await expect(page.locator('.loot-card strong')).toHaveText(rewards)
    await page.locator('.loot-card').filter({ hasText: '一颗特殊骰' }).first().click()
    await page.getByRole('button', { name: /^收入行囊/ }).click()
    await expect(page.getByRole('heading', { name: '炉火桌，有人等你。' })).toBeVisible()
    await close(app)
    ;({ app, page } = await launch(directory, info))
    await page.getByRole('button', { name: /^继续这一夜/ }).click()
    await expect(page.getByRole('heading', { name: '炉火桌，有人等你。' })).toBeVisible()
    await expect(page.locator('.loot-card')).toHaveCount(0)
  } finally { await close(app) }
})

test('closing the window releases its renderer, Dock activation reopens it, and another launch focuses it', async ({}, info) => {
  const directory = info.outputPath('data')
  const { app, page } = await launch(directory, info)
  try {
    await seed(app, page, createAdventure(1, 'window-lifecycle'))
    const second = spawn(executable(), [], { env: environment(directory), stdio: 'ignore', timeout: 15000 })
    const exitCode = await new Promise<number | null>((resolve, reject) => { second.once('exit', resolve); second.once('error', reject) })
    expect(exitCode).toBe(0)
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
    await app.browserWindow(page).then((window) => window.evaluate((window) => window.close()))
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0)
    const reopened = app.waitForEvent('window')
    await app.evaluate(({ app }) => app.emit('activate', {}, false))
    const next = await reopened
    await expect(next.getByRole('button', { name: /^继续这一夜/ })).toBeVisible()
  } finally { await close(app) }
})

test('moving and replacing the application retains its independent user data', async ({}, info) => {
  const directory = info.outputPath('data')
  const movedBundle = info.outputPath('Applications', 'Tavern Bones.app')
  await mkdir(path.dirname(movedBundle), { recursive: true })
  await cp(bundle, movedBundle, { recursive: true, verbatimSymlinks: true })
  let { app, page } = await launch(directory, info, movedBundle)
  try {
    await seed(app, page, createAdventure(1, 'moved-app'))
    const location = await app.evaluate(({ app }) => app.getPath('userData'))
    expect(location).toBe(directory)
    await close(app)
    const oldBundle = movedBundle + '.previous'
    await rename(movedBundle, oldBundle)
    await cp(bundle, movedBundle, { recursive: true, verbatimSymlinks: true })
    await rm(oldBundle, { recursive: true })
    ;({ app, page } = await launch(directory, info, movedBundle))
    await expect(page.getByRole('button', { name: /^继续这一夜/ })).toBeVisible()
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run.id, ADVENTURE_KEY)).toBe('moved-app')
  } finally { await close(app); await rm(movedBundle, { recursive: true, force: true }) }
})

test('plays the complete four-table night offline in the packaged app', async ({}, info) => {
  test.setTimeout(180000)
  const { app, page } = await launch(info.outputPath('data'), info)
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(app, page, createAdventure(COMPLETE_NIGHT_SEED, 'complete-desktop-night'))
    await playCompleteNight(page, () => resumeForeground(app, page))
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).wins, PROFILE_KEY)).toBe(1)
    await page.screenshot({ path: info.outputPath('completed-night.png') })
  } catch (error) {
    const native = await app.browserWindow(page).then((window) => window.evaluate((window) => ({ focused: window.isFocused(), visible: window.isVisible(), minimized: window.isMinimized(), webFocused: window.webContents.isFocused() })))
    const renderer = await page.evaluate(() => ({ focused: document.hasFocus(), hidden: document.hidden, nativeFocused: window.tavernDesktop?.isFocused?.(),
      nativeVisible: window.tavernDesktop?.isVisible(), body: document.body.innerText }))
    await info.attach('focus-state', { body: JSON.stringify({ native, renderer }, null, 2), contentType: 'application/json' })
    throw error
  } finally { await close(app) }
})

test('native focus loss freezes a pending roll and minimization freezes an AI decision until Continue', async ({}, info) => {
  const { app, page } = await launch(info.outputPath('data'), info)
  try {
    await seed(app, page, pending(), false)
    await expect(page.locator('.night-shell')).toHaveAttribute('data-flow', 'rolling')
    const native = await app.browserWindow(page)
    await native.evaluate((window) => window.blur())
    await expect.poll(() => page.evaluate(() => window.tavernDesktop?.isFocused?.())).toBe(false)
    await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY)
    await page.waitForTimeout(6500)
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY)).toEqual(saved)
    await activate(app, page)
    await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect(page.locator('button.dice-hit')).toHaveCount(7)
    const base = adventureReducer(openedNight(14, 'minimized-ai'), { type: 'SIT' })
    const ai: AdventureRun = { ...base, flow: 'decide', game: { ...base.game, currentPlayer: 'ai', phase: 'ai_thinking', turnScore: 400,
      rolledDice: [{ id: 'one', definitionId: 'standard', value: 1, selected: true }, { id: 'two', definitionId: 'standard', value: 2, selected: false }] } }
    await seed(app, page, ai, false)
    await native.evaluate((window) => window.minimize())
    await expect.poll(() => page.evaluate(() => window.tavernDesktop?.isVisible())).toBe(false)
    await page.waitForTimeout(6500)
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).run, ADVENTURE_KEY)).toMatchObject({ flow: 'decide', revision: ai.revision, game: { scores: { ai: 0 } } })
    await native.evaluate((window) => { window.restore(); window.show(); window.focus() })
    await activate(app, page)
    await expect(page.getByRole('dialog', { name: '对局已暂停' })).toBeVisible()
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect(page.getByRole('button', { name: '掷骰子', exact: true })).toBeEnabled()
    await expect(page.locator('.night-scoreband > div').last()).toContainText('500')
  } finally { await close(app) }
})
