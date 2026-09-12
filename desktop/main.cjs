const { app, BrowserWindow, Menu, net, protocol, screen, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { APP_ORIGIN, CONTENT_SECURITY_POLICY, isAppUrl, assetPath } = require('./assets.cjs')

app.setName('Tavern Bones')
// Keep the origin and directories stable when the .app is moved or replaced.
// The override is used by integration tests, which must never touch a player's save.
const dataDirectory = process.env.TAVERN_BONES_DATA_DIR || path.join(app.getPath('appData'), 'Tavern Bones')
fs.mkdirSync(path.join(dataDirectory, 'Chromium'), { recursive: true })
app.setPath('userData', dataDirectory)
app.setPath('sessionData', path.join(dataDirectory, 'Chromium'))

protocol.registerSchemesAsPrivileged([{
  scheme: 'tavern',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true },
}])

let mainWindow = null
let quitting = false

function showGame() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(1280, workArea.width - 32)
  const height = Math.min(800, workArea.height - 64)
  mainWindow = new BrowserWindow({
    title: 'Tavern Bones',
    width, height, useContentSize: true,
    minWidth: Math.min(1024, width), minHeight: Math.min(640, height),
    backgroundColor: '#191d1b',
    show: false,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      autoplayPolicy: 'user-gesture-required',
    },
  })
  const window = mainWindow
  window.once('ready-to-show', () => window.show())
  window.on('page-title-updated', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => { if (!isAppUrl(url)) event.preventDefault() })
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  const publishVisibility = () => {
    const visible = window.isVisible() && !window.isMinimized()
    const focused = window.isFocused()
    window.webContents.setAudioMuted(!visible || !focused)
    window.webContents.send('tavern:visibility', visible)
    window.webContents.send('tavern:focus', focused)
  }
  for (const event of ['minimize', 'restore', 'hide', 'show', 'focus', 'blur']) window.on(event, publishVisibility)
  window.webContents.on('did-finish-load', publishVisibility)
  window.on('close', () => { session.defaultSession.flushStorageData() })
  window.on('closed', () => { mainWindow = null })
  void window.loadURL(APP_ORIGIN + '/')
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (app.isReady() && !quitting) showGame() })
  app.on('activate', () => { if (app.isReady() && !quitting) showGame() })
  // Closing the last window releases the renderer; the Dock can reopen the saved game.
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
  app.on('before-quit', () => { quitting = true; if (app.isReady()) session.defaultSession.flushStorageData() })

  void app.whenReady().then(() => {
    const rendererRoot = path.join(app.getAppPath(), 'dist')
    protocol.handle('tavern', async (request) => {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 })
      const filename = assetPath(request.url, rendererRoot)
      if (!filename) return new Response('Not found', { status: 404 })
      try {
        const response = await net.fetch(pathToFileURL(filename).href)
        const headers = new Headers(response.headers)
        headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
        headers.set('X-Content-Type-Options', 'nosniff')
        return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers })
      } catch { return new Response('Not found', { status: 404 }) }
    })
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    // Packaged gameplay uses no remote resources or local HTTP server.
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }))
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Tavern Bones', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '显示', submenu: [{ role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
      { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }, { type: 'separator' }, { role: 'front' }] },
    ]))
    showGame()
  }).catch((error) => {
    console.error('Unable to start Tavern Bones:', error)
    app.exit(1)
  })
}
