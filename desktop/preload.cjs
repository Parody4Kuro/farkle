const { contextBridge, ipcRenderer } = require('electron')

// A read-only lifecycle signal; the renderer receives no filesystem or IPC access.
let visible = true
const listeners = new Set()
ipcRenderer.on('tavern:visibility', (_event, next) => {
  if (typeof next !== 'boolean' || next === visible) return
  visible = next
  for (const callback of listeners) callback()
})
contextBridge.exposeInMainWorld('tavernDesktop', {
  isVisible: () => visible,
  onVisibilityChange: (callback) => {
    listeners.add(callback)
    return () => { listeners.delete(callback) }
  },
})
