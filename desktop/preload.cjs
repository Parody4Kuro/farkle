const { contextBridge, ipcRenderer } = require('electron')

// A read-only lifecycle signal; the renderer receives no filesystem or IPC access.
let visible = true
let focused = true
const focusListeners = new Set()
const listeners = new Set()
ipcRenderer.on('tavern:visibility', (_event, next) => {
  if (typeof next !== 'boolean' || next === visible) return
  visible = next
  for (const callback of listeners) callback()
})
ipcRenderer.on('tavern:focus', (_event, next) => {
  if (typeof next !== 'boolean' || next === focused) return
  focused = next
  for (const callback of focusListeners) callback()
})
contextBridge.exposeInMainWorld('tavernDesktop', {
  isFocused: () => focused,
  onFocusChange: (callback) => {
    focusListeners.add(callback)
    return () => { focusListeners.delete(callback) }
  },
  isVisible: () => visible,
  onVisibilityChange: (callback) => {
    listeners.add(callback)
    return () => { listeners.delete(callback) }
  },
})
