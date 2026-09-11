import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

// Render the vector at its real display sizes, on both light and dark surfaces.
const directory = 'design/final'
await mkdir(directory, { recursive: true })
const master = 'public/brand/icon.svg'
const small = 'public/brand/icon-small.svg'
const canvas = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="740">
  <rect width="1120" height="740" fill="#FFFFFF"/>
  <g font-family="Helvetica Neue,Arial,sans-serif">
    <text x="42" y="52" fill="#232A32" font-size="27" font-weight="500">Darsena · La piazza, dall’alto</text>
    <text x="42" y="82" fill="#70777F" font-size="16">Porta Ticinese, quercia e un piccolo tram. La stessa cartografia, qualche riferimento in più.</text>
    <text x="608" y="150" fill="#232A32" font-size="17" font-weight="500">Nell’app e nel Dock</text>
    <text x="608" y="177" fill="#70777F" font-size="14">Le dimensioni qui sotto sono quelle effettive.</text>
    <text x="627" y="365" fill="#70777F" font-size="13">128 px</text>
    <text x="800" y="365" fill="#70777F" font-size="13">64 px</text>
    <text x="902" y="365" fill="#70777F" font-size="13">32 px</text>
    <text x="995" y="365" fill="#70777F" font-size="13">16 px</text>
    <rect x="590" y="398" width="488" height="224" rx="18" fill="#22252B"/>
    <text x="612" y="432" fill="#D0D3D8" font-size="14">Su fondo scuro</text>
    <text x="42" y="694" fill="#70777F" font-size="14">Acqua blu · Porta grigia · Quercia verde · Tram giallo-arancio · Campiture piatte</text>
  </g>
</svg>`)
const layers = [{ input: await sharp(master).resize(512).png().toBuffer(), left: 32, top: 120 }]
for (const [size, left] of [
  [128, 608],
  [64, 788],
  [32, 904],
  [16, 1000],
]) {
  const input = await sharp(size <= 32 ? small : master)
    .resize(size)
    .png()
    .toBuffer()
  layers.push({ input, left, top: 208 + Math.round((128 - size) / 2) })
  layers.push({ input, left, top: 456 + Math.round((128 - size) / 2) })
}
await sharp(canvas).composite(layers).png().toFile(`${directory}/icon-landmarks-preview.png`)
await sharp(master).resize(512).png().toFile(`${directory}/icon-landmarks-512.png`)
console.log(`Created ${directory}/icon-landmarks-preview.png`)
