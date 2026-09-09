import sharp from 'sharp'
import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const dir = fileURLToPath(new URL('.', import.meta.url))
const paper = '#F5F6F3'
const city = '#E4E7E2'
const water = '#2D46C8'
const basin = 'M355 181C414 221 465 280 509 333L548 373Q565 390 588 389L678 381 681 396 725 392 724 378 742 377 750 429Q753 445 737 449L660 459Q628 462 603 470L581 476Q558 481 537 465C487 426 425 362 370 310L297 240Q286 230 295 220L342 181Q348 176 355 181Z'
const grande = 'M600 457C551 481 493 504 431 527S237 601 105 647'
const pavese = 'M670 445C663 504 651 557 646 606S632 710 626 757'
const grandeExtended = `${grande}C-160 739-510 858-850 975`
const paveseExtended = `${pavese}C619 813 608 899 594 1000`

const blocks = [
 'M260 142 319 92 377 145 318 197Z',
 'M358 65 394 36 456 94 422 125Z',
 'M421 156 454 123 507 172 473 207Z',
 'M488 222 522 187 572 236 539 272Z',
 'M554 286 588 251 645 302 610 337Z',
 'M474 82 504 55 562 109 532 139Z',
 'M550 154 583 119 645 171 612 208Z',
 'M628 224 661 188 717 239 686 276Z',
 'M641 327 674 299 727 312 724 349 685 354Z',
 'M744 245 805 251 801 293 740 285Z',
 'M752 317 811 321 812 359 751 356Z',
 'M779 390 842 383 849 432 786 439Z',
 'M815 462 867 452 875 508 822 519Z',
 'M716 481 779 472 789 523 708 546Z',
 'M708 572 781 549 789 602 700 628Z',
 'M694 654 780 628 782 681 686 711Z',
 'M683 738 735 721 735 766 678 784Z',
 'M248 270 279 247 334 300 303 329Z',
 'M206 302 231 284 289 343 264 367Z',
 'M322 344 349 318 406 373 380 400Z',
 'M395 415 421 389 477 443 448 465Z',
 'M478 477 496 462 519 482 476 499Z',
 'M244 403 285 377 347 432 309 462Z',
 'M324 478 363 448 405 480 355 500Z',
 'M197 447 219 426 278 480 242 502Z',
 'M171 518 212 477 231 510 174 532Z',
 'M524 537 601 511 599 551 533 578Z',
 'M471 572 507 550 516 590 481 611Z',
 'M520 609 594 580 587 629 531 660Z',
 'M430 631 461 613 482 645 450 666Z',
 'M530 685 583 656 577 704 537 733Z',
 'M473 717 505 693 518 739 480 768Z',
 'M318 637 353 616 397 654 363 679Z',
 'M279 678 305 655 347 694 321 718Z',
 'M391 698 422 675 450 709 416 736Z',
 'M225 679 248 666 267 691 242 707Z',
 'M179 689 205 680 216 708 190 718Z',
 'M316 766 351 741 378 770 341 794Z',
]
const outerBlocks = [
 'M402-140 538-124 528 10 409-6Z',
 'M-500 512-392 488-363 551-467 582Z',
 'M1200 112H1400V214H1190Z',
 'M38 99 146 12 229 92 117 181Z',
 'M69 234 162 169 215 219 117 309Z',
 'M21 369 118 301 164 352 75 431Z',
 'M36 500 112 447 152 490 66 553Z',
 'M70 802 205 746 244 790 105 853Z',
 'M271 839 372 811 440 866 323 912Z',
 'M877 178 976 189 968 295 868 280Z',
 'M893 343 1010 331 1019 437 904 449Z',
 'M910 489 1020 472 1037 580 923 608Z',
 'M830 750 954 712 964 825 838 867Z',
 'M698 851 786 823 786 923 690 961Z',
]

function cityPaths(extra = false) {
 return `<g fill="${city}">${[...blocks, ...(extra ? outerBlocks : [])].map(d => `<path d="${d}"/>`).join('')}</g>`
}
function cubicLength(points) {
 let total=0, previous=points[0]
 for(let i=1;i<=1000;i++) {
  const t=i/1000, u=1-t
  const point=[0,1].map(j=>u*u*u*points[0][j]+3*u*u*t*points[1][j]+3*u*t*t*points[2][j]+t*t*t*points[3][j])
  total += Math.hypot(point[0]-previous[0],point[1]-previous[1])
  previous=point
 }
 return total
}
const grandeLength=cubicLength([[600,457],[551,481],[493,504],[431,527]])+cubicLength([[431,527],[369,550],[237,601],[105,647]])
const paveseLength=cubicLength([[670,445],[663,504],[651,557],[646,606]])+cubicLength([[646,606],[641,655],[632,710],[626,757]])
function segmented(length) {
 return ` stroke-dasharray="${[.760,.025,.100,.025,.050,.025,.015].map(part=>(part*length).toFixed(3)).join(' ')}"`
}
function waterPaths(variant, color = water) {
 const pathOptions = `fill="none" stroke-linejoin="round" stroke-linecap="${variant === 'C' ? 'butt' : 'round'}"`
 const grandeDash = variant === 'C' ? segmented(grandeLength) : ''
 const paveseDash = variant === 'C' ? segmented(paveseLength) : ''
 const channels = `<g stroke="${color}" ${pathOptions}><path d="${variant === 'A' ? grandeExtended : grande}" stroke-width="34"${grandeDash}/><path d="${variant === 'A' ? paveseExtended : pavese}" stroke-width="32"${paveseDash}/></g>`
 return `${channels}<path d="${basin}" fill="${color}"/>`
}
function illustration(variant) {
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640"><title>Darsena — studio ${variant}</title><desc>Schema originale senza etichette: bacino a nord-ovest, testata a sud-est, Grande verso sud-ovest e Pavese verso sud. Campiture piatte e geometria condivisa tra gli studi.</desc><defs><clipPath id="frame"><rect width="1200" height="640"/></clipPath></defs><g clip-path="url(#frame)"><rect width="1200" height="640" fill="${paper}"/><g transform="translate(250 22) scale(.70)">${cityPaths(variant === 'A')}${waterPaths(variant)}</g></g></svg>`
}
for (const variant of ['A', 'B', 'C']) {
 const svg = illustration(variant)
 await writeFile(join(dir, `studio-${variant.toLowerCase()}.svg`), svg)
 await sharp(Buffer.from(svg)).png().toFile(join(dir, `studio-${variant.toLowerCase()}.png`))
}
const dark = illustration('C').replaceAll(paper, '#20232A').replaceAll(city, '#292D35').replaceAll(water, '#728BFA')
await writeFile(join(dir, 'studio-c-dark.svg'), dark)
await sharp(Buffer.from(dark)).png().toFile(join(dir, 'studio-c-dark.png'))
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>Darsena — studio C, icona</title><rect x="62" y="62" width="900" height="900" rx="204" fill="${paper}"/><g transform="translate(83 103) scale(.92)">${cityPaths()}${waterPaths('C')}</g></svg>`
await writeFile(join(dir, 'icon-c.svg'), icon)
for (const size of [24,32,64,128,512,1024]) {
 let source=icon
 if(size<=32) {
  // The smallest terminal fragment falls below a pixel. Omit it in small raster exports only.
  for(const length of [grandeLength,paveseLength]) {
   source=source.replace(segmented(length), ` stroke-dasharray="${[.760,.025,.100,.025,.050,.04].map(part=>(part*length).toFixed(3)).join(' ')}"`)
  }
 }
 if(size===32) await writeFile(join(dir,'icon-c-small.svg'),source)
 await sharp(Buffer.from(source)).resize(size).png().toFile(join(dir, `icon-c-${size}.png`))
}
const marks = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>Darsena — studio C, segno</title><g transform="translate(45 30) scale(1.08)">${waterPaths('C','#1B2435')}</g></svg>`
await writeFile(join(dir, 'mark-c.svg'), marks)
await sharp(Buffer.from(marks)).resize(240).png().toFile(join(dir,'mark-c.png'))
console.log('Rendered A/B/C, icon C and monochrome mark C')

const board = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="438"><rect width="1800" height="438" fill="#FFFFFF"/><g font-family="Helvetica Neue,Arial,sans-serif" fill="#1B2435" font-size="21" font-weight="500"><text x="30" y="39">A · Ritaglio continuo</text><text x="620" y="39">B · Composizione raccolta</text><text x="1210" y="39">C · Finali in segmenti</text></g><g font-family="Helvetica Neue,Arial,sans-serif" fill="#757C86" font-size="14"><text x="30" y="65">La mappa prosegue oltre il bordo.</text><text x="620" y="65">Canali e isolati interamente visibili.</text><text x="1210" y="65">Tre frammenti, sempre più brevi.</text></g></svg>`)
const panels = await Promise.all(['a','b','c'].map(async(letter,index)=>({input:await sharp(join(dir,`studio-${letter}.png`)).resize(560).png().toBuffer(),left:30+index*590,top:97})))
await sharp(board).composite(panels).png().toFile(join(dir,'preview.png'))
const checks=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="980" height="230"><rect width="980" height="230" fill="#FFFFFF"/><g font-family="Helvetica Neue,Arial,sans-serif" fill="#757C86" font-size="14"><text x="30" y="201">128 px</text><text x="244" y="201">64 px</text><text x="399" y="201">32 px</text><text x="530" y="201">24 px</text><text x="689" y="201">Segno monocromatico</text></g></svg>`)
const mark=await sharp(join(dir,'mark-c.svg')).resize(140).png().toBuffer()
await sharp(checks).composite([{input:join(dir,'icon-c-128.png'),left:30,top:35},{input:join(dir,'icon-c-64.png'),left:242,top:69},{input:join(dir,'icon-c-32.png'),left:398,top:85},{input:join(dir,'icon-c-24.png'),left:530,top:89},{input:mark,left:688,top:29}]).png().toFile(join(dir,'icon-c-check.png'))
