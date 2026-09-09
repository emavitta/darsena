import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const source = 'public/brand/icon.svg'
const smallSource = 'public/brand/icon-small.svg'
const rendered = await sharp(source).resize(1024, 1024).png().toBuffer()
const metadata = await sharp(rendered).metadata()
if (!metadata.hasAlpha || (await sharp(rendered).stats()).channels[3].min !== 0) {
  throw new Error('The icon master must have a real transparent background.')
}
await mkdir('build/Darsena.iconset', { recursive: true })
await sharp(rendered).toFile('public/brand/icon.png')
for (const size of [16, 32, 128, 256, 512]) {
  for (const factor of [1, 2]) {
    await sharp(size <= 32 ? smallSource : source)
      .resize(size * factor)
      .png()
      .toFile(`build/Darsena.iconset/icon_${size}x${size}${factor === 2 ? '@2x' : ''}.png`)
  }
}
await promisify(execFile)('/usr/bin/iconutil', [
  '-c',
  'icns',
  'build/Darsena.iconset',
  '-o',
  'build/icon.icns',
])
