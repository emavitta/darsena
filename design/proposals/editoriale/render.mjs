import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const icon = await readFile(path.join(dir, 'icon.svg'))
const mark = await readFile(path.join(dir, 'mark.svg'), 'utf8')
const harbor = await readFile(path.join(dir, 'harbor.svg'))
await sharp(icon).png().toFile(path.join(dir, 'icon.png'))
await sharp(harbor).png().toFile(path.join(dir, 'harbor.png'))
const uri = b => `data:image/svg+xml;base64,${Buffer.from(b).toString('base64')}`
const iconUri = uri(icon)
const blackMark = uri(mark.replace('currentColor', '#1D202A'))
const whiteMark = uri(mark.replace('currentColor', '#FAF9F4'))
const sizes = [16, 24, 32, 48, 64]
const smallMarks = sizes.map((s, i) => `<image href="${blackMark}" x="${764 + 96 * i}" y="${235 - s / 2}" width="${s}" height="${s}"/><text x="${764 + 96 * i + s / 2}" y="307" text-anchor="middle" class="tiny">${s} px</text>`).join('')
const smallIcons = sizes.map((s, i) => `<image href="${iconUri}" x="${764 + 96 * i}" y="${384 - s / 2}" width="${s}" height="${s}"/>`).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1080" viewBox="0 0 1440 1080">
<style>text{font-family:Helvetica Neue,Arial,sans-serif;fill:#1D202A}.label{font-size:15px;font-weight:500;letter-spacing:2px}.tiny{font-size:13px;fill:#74767F}</style>
<rect width="1440" height="1080" fill="#FAF9F4"/>
<text x="68" y="62" class="label">DARSENA / DUE SPONDE</text><text x="1372" y="62" text-anchor="end" class="tiny">Proposta 02 · Editoriale</text>
<path d="M68 88H1372" stroke="#DAD9D2"/>
<image href="${iconUri}" x="74" y="129" width="560" height="560"/>
<text x="750" y="154" class="label">IL SEGNO, ALLA SCALA D'USO</text>
${smallMarks}${smallIcons}
<image href="${blackMark}" x="750" y="484" width="72" height="72"/>
<text x="843" y="542" font-size="71" font-weight="500" letter-spacing="-3">darsena</text>
<path d="M750 606H1310" stroke="#DAD9D2"/>
<rect x="750" y="631" width="172" height="43" fill="#1D202A"/><rect x="937" y="631" width="172" height="43" fill="#293CE6"/><rect x="1124" y="631" width="172" height="43" fill="#FAF9F4" stroke="#DAD9D2"/>
<text x="750" y="702" class="tiny">Inchiostro</text><text x="937" y="702" class="tiny">Cobalto</text><text x="1124" y="702" class="tiny">Carta</text>
<path d="M68 748H1372" stroke="#DAD9D2"/>
<text x="68" y="797" class="label">UN BACINO APERTO. DUE SPONDE.</text>
<text x="68" y="838" font-size="18" fill="#74767F">Un approdo urbano, in un segno essenziale.</text>
<image href="${uri(harbor)}" x="680" y="768" width="648" height="288"/>
<rect x="68" y="892" width="250" height="136" rx="18" fill="#1D202A"/>
<image href="${whiteMark}" x="105" y="927" width="64" height="64"/>
<text x="185" y="967" font-size="22" font-weight="500" style="fill:#FAF9F4">darsena</text>
</svg>`
await writeFile(path.join(dir, 'contact-sheet.svg'), svg)
await sharp(Buffer.from(svg)).png().toFile(path.join(dir, 'contact-sheet.png'))
