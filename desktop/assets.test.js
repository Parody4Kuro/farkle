import { describe, expect, it } from 'vitest'
import { assetPath, isAppUrl } from './assets.cjs'

describe('bundled application protocol', () => {
  const root = '/Applications/Tavern Bones.app/Contents/Resources/app.asar/dist'
  it('resolves the entry point, hashed chunks, and worker without a server', () => {
    expect(assetPath('tavern://game/', root)).toBe(root + '/index.html')
    expect(assetPath('tavern://game/assets/physics.worker-a.js?v=1', root)).toBe(root + '/assets/physics.worker-a.js')
    expect(assetPath('tavern://game/assets/TavernScene-b.js', root)).toBe(root + '/assets/TavernScene-b.js')
  })
  it('rejects outside origins and encoded path traversal', () => {
    for (const url of ['file:///etc/passwd', 'https://game/', 'tavern://other/', 'tavern://user@game/', 'tavern://game:123/',
      'tavern://game/%2e%2e%2fsecret', 'tavern://game/%00', 'tavern://game/%5csecret', 'tavern://game/%bad']) {
      expect(assetPath(url, root), url).toBeNull()
    }
    expect(isAppUrl('https://example.com')).toBe(false)
    expect(isAppUrl('tavern://game/')).toBe(true)
  })
})
