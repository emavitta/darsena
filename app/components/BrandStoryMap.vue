<script setup lang="ts">
type Landmark = 'harbor' | 'gate' | 'oak' | 'tram'
defineProps<{ active: Landmark }>()
const emit = defineEmits<{ select: [landmark: Landmark] }>()
const landmarks: {
  id: Landmark
  number: string
  name: string
  color: string
  x: number
  y: number
  target: [number, number]
  leader: string
}[] = [
  {
    id: 'harbor',
    number: '01',
    name: 'Darsena & Navigli',
    color: '#2D46C8',
    x: 17,
    y: 25,
    target: [510, 414],
    leader: 'M174 256H300L455 379',
  },
  {
    id: 'gate',
    number: '02',
    name: 'Porta Ticinese',
    color: '#66736B',
    x: 89,
    y: 65,
    target: [833, 483],
    leader: 'M911 666V570L856 519',
  },
  {
    id: 'oak',
    number: '03',
    name: 'The monumental oak',
    color: '#4B8050',
    x: 71,
    y: 84,
    target: [798, 545],
    leader: 'M727 860V660L780 585',
  },
  {
    id: 'tram',
    number: '04',
    name: 'The Milanese tram',
    color: '#AF6B0F',
    x: 89,
    y: 25,
    target: [838, 444],
    leader: 'M911 256V350L860 408',
  },
]
</script>
<template>
  <figure class="story-map">
    <div class="story-map-canvas">
      <svg class="story-map-art" viewBox="0 0 1024 1024" aria-hidden="true">
        <desc>
          Cartografia in pianta: Darsena e Navigli in blu, Porta Ticinese come un rettangolo grigio,
          la quercia verde nella piazza e un piccolo rettangolo giallo-arancio per il tram.
          Campiture piatte, senza dettagli interni o rotaie.
        </desc>
        <rect x="62" y="62" width="900" height="900" rx="204" fill="#F5F6F3" />
        <g transform="translate(83 103) scale(.92)">
          <g fill="#E4E7E2">
            <path d="M260 142 319 92 377 145 318 197Z" />
            <path d="M358 65 394 36 456 94 422 125Z" />
            <path d="M421 156 454 123 507 172 473 207Z" />
            <path d="M488 222 522 187 572 236 539 272Z" />
            <path d="M554 286 588 251 645 302 610 337Z" />
            <path d="M474 82 504 55 562 109 532 139Z" />
            <path d="M550 154 583 119 645 171 612 208Z" />
            <path d="M628 224 661 188 717 239 686 276Z" />
            <path d="M641 327 674 299 727 312 724 349 685 354Z" />
            <path d="M744 245 805 251 801 293 740 285Z" />
            <path d="M752 317 811 321 812 359 751 356Z" />
            <path d="M815 462 867 452 875 508 822 519Z" />
            <path d="M708 572 781 549 789 602 700 628Z" />
            <path d="M694 654 780 628 782 681 686 711Z" />
            <path d="M683 738 735 721 735 766 678 784Z" />
            <path d="M248 270 279 247 334 300 303 329Z" />
            <path d="M206 302 231 284 289 343 264 367Z" />
            <path d="M322 344 349 318 406 373 380 400Z" />
            <path d="M395 415 421 389 477 443 448 465Z" />
            <path d="M478 477 496 462 519 482 476 499Z" />
            <path d="M244 403 285 377 347 432 309 462Z" />
            <path d="M324 478 363 448 405 480 355 500Z" />
            <path d="M197 447 219 426 278 480 242 502Z" />
            <path d="M171 518 212 477 231 510 174 532Z" />
            <path d="M524 537 601 511 599 551 533 578Z" />
            <path d="M471 572 507 550 516 590 481 611Z" />
            <path d="M520 609 594 580 587 629 531 660Z" />
            <path d="M430 631 461 613 482 645 450 666Z" />
            <path d="M530 685 583 656 577 704 537 733Z" />
            <path d="M473 717 505 693 518 739 480 768Z" />
            <path d="M318 637 353 616 397 654 363 679Z" />
            <path d="M279 678 305 655 347 694 321 718Z" />
            <path d="M391 698 422 675 450 709 416 736Z" />
            <path d="M225 679 248 666 267 691 242 707Z" />
            <path d="M179 689 205 680 216 708 190 718Z" />
            <path d="M316 766 351 741 378 770 341 794Z" />
          </g>
          <!-- Composite the water before applying opacity: canal junctions must stay uniform. -->
          <g :opacity="active === 'harbor' ? 1 : 0.65">
            <g stroke="#2D46C8" fill="none" stroke-linejoin="round" stroke-linecap="butt">
              <path
                d="M600 447C551 481 493 504 431 527S237 601 105 647"
                stroke-width="34"
                stroke-dasharray="403.098 13.260 53.039 13.260 26.520 13.260 7.956"
              />
              <path
                d="M670 445C663 504 651 557 646 606S632 710 626 757"
                stroke-width="32"
                stroke-dasharray="239.499 7.878 31.513 7.878 15.756 7.878 4.727"
              />
            </g>
            <path
              d="M355 181C414 221 465 280 509 333L548 373Q565 390 588 389L678 381 681 396 725 392 724 378 742 377 750 429Q753 445 737 449L660 459Q628 462 603 470L581 476Q558 481 537 465C487 426 425 362 370 310L297 240Q286 230 295 220L342 181Q348 176 355 181Z"
              fill="#2D46C8"
            />
          </g>
          <!-- Piazza XXIV Maggio: a gray gate, green oak canopy and amber tram. -->
          <g :opacity="active === 'gate' ? 1 : 0.65" transform="translate(815 413) rotate(6)">
            <rect x="-32" y="-23" width="64" height="46" fill="#929B95" />
          </g>
          <path
            :opacity="active === 'oak' ? 1 : 0.65"
            d="M775 451C784 447 794 453 795 461C806 461 811 470 807 479C813 489 806 502 795 501C788 511 773 511 768 502C757 507 747 498 750 489C741 482 746 468 755 466C755 455 766 449 775 451Z"
            fill="#68976B"
          />
          <g :opacity="active === 'tram' ? 1 : 0.65" transform="translate(821 371) rotate(5)">
            <rect x="-24" y="-7" width="48" height="14" fill="#E4A23B" />
          </g>
        </g>
        <g fill="none" stroke-width="5">
          <path
            v-for="landmark in landmarks"
            :key="landmark.id"
            :d="landmark.leader"
            :stroke="landmark.color"
            :opacity="active === landmark.id ? 1 : 0.35"
          />
          <circle
            v-for="landmark in landmarks"
            :key="`halo-${landmark.id}`"
            :cx="landmark.target[0]"
            :cy="landmark.target[1]"
            :r="landmark.id === 'harbor' ? 70 : 43"
            :stroke="landmark.color"
            :stroke-width="active === landmark.id ? 9 : 3"
            :opacity="active === landmark.id ? 0.9 : 0.2"
          />
        </g>
      </svg>

      <button
        v-for="landmark in landmarks"
        :key="landmark.id"
        class="map-callout"
        :class="{ active: active === landmark.id }"
        :style="{
          left: `${landmark.x}%`,
          top: `${landmark.y}%`,
          '--landmark-color': landmark.color,
        }"
        :aria-label="`Read about ${landmark.name}`"
        :aria-pressed="active === landmark.id"
        @click="emit('select', landmark.id)"
      >
        {{ landmark.number }}
      </button>
    </div>
    <figcaption class="map-caption">Four places behind the icon</figcaption>
    <div class="map-legend" aria-label="Places on the map">
      <button
        v-for="landmark in landmarks"
        :key="landmark.id"
        class="map-legend-item"
        :class="{ active: active === landmark.id }"
        :style="{ '--landmark-color': landmark.color }"
        :aria-pressed="active === landmark.id"
        @click="emit('select', landmark.id)"
      >
        <span class="map-legend-number">{{ landmark.number }}</span>
        <span>{{ landmark.name }}</span>
      </button>
    </div>
  </figure>
</template>
<style scoped>
.story-map {
  margin: 0;
  width: 100%;
}
.story-map-canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}
.story-map-art {
  display: block;
  width: 100%;
  height: auto;
}
.map-callout {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border: 1px solid var(--landmark-color);
  border-radius: 50%;
  background: #f5f6f3;
  color: var(--landmark-color);
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 2px 8px #0000000c;
}
.map-callout.active {
  background: var(--landmark-color);
  color: white;
}
.map-callout:hover {
  box-shadow: 0 0 0 4px #929b9526;
}
.map-caption {
  color: var(--muted);
  font-size: 12px;
  margin: 8px 0 12px;
  text-align: center;
}
.map-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
}
.map-legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 7px 10px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 7px;
  font-size: 13px;
  color: var(--muted);
}
.map-legend-item.active {
  border-color: var(--line);
  background: var(--surface);
  color: var(--text);
}
.map-legend-item:hover {
  background: var(--surface);
  color: var(--text);
}
.map-legend-number {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #f5f6f3;
  color: var(--landmark-color);
  font-size: 11px;
  font-weight: 700;
}
.map-callout:focus-visible,
.map-legend-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
</style>
