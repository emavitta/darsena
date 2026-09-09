import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const target = process.platform === 'win32' ? 'windows-x64' : 'macos-arm64'
const files =
  target === 'windows-x64'
    ? [`Darsena-${version}-windows-x64.exe`, `Darsena-${version}-windows-x64.zip`]
    : [`Darsena-${version}-arm64.dmg`, `Darsena-${version}-arm64-mac.zip`]
const checksums = []
for (const file of files) {
  const buffer = await readFile(path.join('release', file))
  checksums.push(`${createHash('sha256').update(buffer).digest('hex')}  ${file}`)
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
await writeFile(`release/SHA256SUMS-${target}.txt`, checksums.join('\n') + '\n')
await writeFile(
  `release/build-${target}.json`,
  JSON.stringify({ version, target, commit, signed: false }, null, 2) + '\n',
)
