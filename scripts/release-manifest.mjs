import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const arch = process.env.DARSENA_ARCH || 'arm64'
if (!['arm64', 'x64'].includes(arch)) throw new Error('Unsupported macOS architecture')
const files = [`Darsena-${version}-${arch}.dmg`, `Darsena-${version}-${arch}-mac.zip`]
const app = path.join(root, arch === 'arm64' ? 'release/mac-arm64/Darsena.app' : 'release/mac/Darsena.app')
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
await writeFile(path.join(root, `release/SHA256SUMS-macos-${arch}.txt`), checksums.join('\n') + '\n')
await writeFile(
  path.join(root, `release/build-macos-${arch}.json`),
  JSON.stringify({ version, target: `macos-${arch}`, commit, signed, signing: signed ? 'Developer ID' : 'ad-hoc', notarized }, null, 2) + '\n',
)
