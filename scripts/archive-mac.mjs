import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { extractFile } from '@electron/asar'

const root = path.resolve(import.meta.dirname, '..')
const run = (command, args) => execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim()
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const files = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`])
const sourceCommit = run('git', ['rev-parse', 'HEAD'])
if (run('git', ['status', '--porcelain', '--', 'src', 'dist', 'desktop', 'package.json', 'package-lock.json'])) throw new Error('Commit application sources and dist before archiving.')
const app = 'release/mac-arm64/Tavern Bones.app'
const output = 'artifacts/macos'
const archive = `${output}/Tavern-Bones-mac-arm64.zip`
run('codesign', ['--verify', '--deep', '--strict', app])
run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, archive])
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-archive-'))
try {
  run('ditto', ['-x', '-k', archive, temporary])
  const unpacked = path.join(temporary, 'Tavern Bones.app')
  run('codesign', ['--verify', '--deep', '--strict', unpacked])
  const asar = path.join(unpacked, 'Contents/Resources/app.asar')
  const asarHash = sha(fs.readFileSync(asar))
  if (asarHash !== sha(fs.readFileSync(path.join(root, app, 'Contents/Resources/app.asar')))) throw new Error('Archive differs from local app')
  const verify = (file) => {
    const bytes = fs.readFileSync(path.join(root, file))
    if (!bytes.equals(extractFile(asar, file))) throw new Error(`Packaged resource differs: ${file}`)
    return { path: file, sha256: sha(bytes) }
  }
  const rendererFiles = files('dist').map(verify)
  const desktopFiles = files('desktop').filter((file) => file.endsWith('.cjs')).map(verify)
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (JSON.parse(extractFile(asar, 'package.json').toString()).version !== pkg.version) throw new Error('Package version mismatch')
  if (run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(unpacked, 'Contents/Info.plist')]) !== pkg.version) throw new Error('Bundle version mismatch')
  const manifest = {
    product: 'Tavern Bones', platform: 'darwin', architecture: 'arm64', applicationVersion: pkg.version,
    electronVersion: pkg.devDependencies.electron, sourceCommit, archivedAt: new Date().toISOString(),
    archive: { file: path.basename(archive), bytes: fs.statSync(path.join(root, archive)).size, sha256: sha(fs.readFileSync(path.join(root, archive))) },
    appAsarSha256: asarHash, rendererFiles, desktopFiles,
    verification: { extractedSignature: 'codesign --verify --deep --strict: passed', archiveMatchesLocalApp: true, rendererMatchesDist: true, desktopMatchesSource: true, bundleVersionMatchesPackage: true },
    validationReport: 'docs/friends-validation.md', saveDataIncluded: false,
  }
  const text = JSON.stringify(manifest, null, 2) + '\n'
  fs.writeFileSync(path.join(root, output, 'manifest.json'), text)
  fs.writeFileSync(path.join(root, output, 'SHA256SUMS.txt'), `${manifest.archive.sha256}  ${path.basename(archive)}\n${sha(text)}  manifest.json\n`)
  console.log(JSON.stringify({ sourceCommit, archive: manifest.archive, verified: true }, null, 2))
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
