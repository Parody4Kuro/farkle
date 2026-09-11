const path = require('node:path')

const APP_ORIGIN = 'tavern://game'
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "form-action 'none'",
].join('; ')

function isAppUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'tavern:' && url.host === 'game' && !url.username && !url.password
  } catch { return false }
}

/** Resolve only files inside the bundled renderer, including Vite's lazy chunks and Worker. */
function assetPath(value, root) {
  if (!isAppUrl(value)) return null
  try {
    const pathname = decodeURIComponent(new URL(value).pathname)
    if (pathname.includes('\0') || pathname.includes('\\')) return null
    const target = path.resolve(root, '.' + (pathname === '/' || pathname === '' ? '/index.html' : pathname))
    const relative = path.relative(root, target)
    return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) ? target : null
  } catch { return null }
}

module.exports = { APP_ORIGIN, CONTENT_SECURITY_POLICY, isAppUrl, assetPath }
