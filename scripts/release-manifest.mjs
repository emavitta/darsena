import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const files = [`Darsena-${version}-arm64.dmg`, `Darsena-${version}-arm64-mac.zip`]
const app = path.join(root, 'release/mac-arm64/Darsena.app')
let signed = false, notarized = false
try {
  execFileSync('codesign', ['--verify', '-R=anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists', app], { stdio: 'ignore' })
  signed = true
  execFileSync('xcrun', ['stapler', 'validate', app], { stdio: 'ignore' })
  notarized = true
} catch {}
const checksums = []
for (const file of files) {
  const buffer = await readFile(path.join(root, 'release', file))
  checksums.push(`${createHash('sha256').update(buffer).digest('hex')}  ${file}`)
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
await writeFile(path.join(root, 'release/SHA256SUMS-macos-arm64.txt'), checksums.join('\n') + '\n')
await writeFile(
  path.join(root, 'release/build-macos-arm64.json'),
  JSON.stringify({ version, target: 'macos-arm64', commit, signed, signing: signed ? 'Developer ID' : 'ad-hoc', notarized }, null, 2) + '\n',
)
