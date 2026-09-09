import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const dir = fileURLToPath(new URL('.', import.meta.url))
await sharp(join(dir, 'icon.svg')).png().toFile(join(dir, 'icon.png'))
await sharp(join(dir, 'harbor.svg')).png().toFile(join(dir, 'harbor.png'))
await sharp(join(dir, 'harbor-dark.svg')).png().toFile(join(dir, 'harbor-dark.png'))
for (const size of [24, 32, 64, 128, 256]) {
  await sharp(join(dir, 'icon.svg')).resize(size).png().toFile(join(dir, `icon-${size}.png`))
}
const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1380"><rect width="1500" height="1380" fill="#F4F5F2"/><text x="60" y="77" font-family="Helvetica Neue,Arial" font-size="22" fill="#2D46C8" letter-spacing="3">DARSENA / ATLANTE</text><text x="60" y="125" font-family="Helvetica Neue,Arial" font-size="16" fill="#666">Bacino, canali, città. Una direzione cartografica.</text><text x="465" y="203" font-family="Helvetica Neue,Arial" font-size="60" font-weight="500" letter-spacing="-2" fill="#192338">Darsena</text><text x="470" y="248" font-family="Helvetica Neue,Arial" font-size="20" fill="#666">Un porto per i tuoi worktree.</text><text x="64" y="536" font-family="Helvetica Neue,Arial" font-size="13" fill="#666" letter-spacing="2">ICONA · 320 PX</text><text x="474" y="435" font-family="Helvetica Neue,Arial" font-size="13" fill="#666" letter-spacing="2">64 / 32 / 24 PX</text><text x="1044" y="315" font-family="Helvetica Neue,Arial" font-size="13" fill="#666" letter-spacing="2">MARK MONOCROMATICO</text></svg>`)
const icon320 = await sharp(join(dir, 'icon.svg')).resize(320).png().toBuffer()
const harbor = await sharp(join(dir, 'harbor.svg')).resize(1380).png().toBuffer()
const mark = await sharp(Buffer.from((await readFile(join(dir, 'mark.svg'), 'utf8')).replace('currentColor', '#192338'))).resize(80).png().toBuffer()
await sharp(background).composite([
  { input: icon320, left: 50, top: 180 },
  { input: mark, left: 1080, top: 180 },
  { input: join(dir, 'icon-64.png'), left: 472, top: 323 },
  { input: join(dir, 'icon-32.png'), left: 570, top: 342 },
  { input: join(dir, 'icon-24.png'), left: 645, top: 347 },
  { input: harbor, left: 60, top: 575 },
]).png().toFile(join(dir, 'preview.png'))
