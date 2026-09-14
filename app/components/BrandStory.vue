<script setup lang="ts">
import { brandStory } from '../content/brandStory'

const emit = defineEmits<{ back: []; openUrl: [url: string] }>()
const heading = useTemplateRef('heading')
const article = useTemplateRef('article')
type StoryId = (typeof brandStory)[number]['id']
const active = shallowRef<StoryId>('harbor')
let dialog: HTMLDialogElement | null = null
let frame = 0
let resizeObserver: ResizeObserver | undefined
const finalSectionHeight = shallowRef(0)
const readingOffset = () => Math.min(150, (dialog?.clientHeight || 450) / 3)
function resizeReadingArea() {
  if (!dialog) return
  // Let the last heading reach the same reading line as every preceding one.
  // This also gives short penultimate sections their own scroll interval.
  finalSectionHeight.value = Math.ceil(dialog.clientHeight - readingOffset()) + 1
  onScroll()
}
function updateSection() {
  if (!dialog) return
  const sections = Array.from(article.value?.querySelectorAll<HTMLElement>('.story-section') || [])
  const readingLine = dialog.getBoundingClientRect().top + readingOffset()
  let visible = sections[0]
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= readingLine + 1) visible = section
  }
  if (visible) active.value = visible.dataset.story as StoryId
}
function onScroll() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(updateSection)
}
function selectSection(id: StoryId) {
  active.value = id
  const section = article.value?.querySelector<HTMLElement>(`[data-story="${id}"]`)
  if (dialog && section) {
    dialog.scrollTo({
      top:
        dialog.scrollTop +
        section.getBoundingClientRect().top -
        dialog.getBoundingClientRect().top -
        readingOffset(),
      behavior: 'instant',
    })
  }
}
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  dialog?.removeEventListener('scroll', onScroll)
  cancelAnimationFrame(frame)
})

onMounted(async () => {
  // The parent dialog must be open before the reading heading can receive focus.
  await nextTick()
  heading.value?.focus({ preventScroll: true })
  dialog = article.value?.closest('dialog') || null
  dialog?.addEventListener('scroll', onScroll, { passive: true })
  resizeObserver = new ResizeObserver(resizeReadingArea)
  if (dialog) resizeObserver.observe(dialog)
  resizeReadingArea()
})

function openSource(event: MouseEvent, url: string) {
  if (window.darsena) {
    event.preventDefault()
    emit('openUrl', url)
  }
}
</script>

<template>
  <article ref="article" class="brand-story" :style="{ '--story-final-height': `${finalSectionHeight}px` }">
    <button class="story-back" @click="emit('back')">
      <AppIcon name="ArrowLeft" :size="15" />Back to About
    </button>
    <div class="story-layout">
      <div class="story-text">
        <header class="story-introduction">
          <div>
            <p class="story-eyebrow">Milano · Darsena &amp; Piazza XXIV Maggio</p>
            <h3 ref="heading" tabindex="-1" class="story-title">
              A harbor for things being built.
            </h3>
            <p class="story-deck">The place, the name, and four small details in our icon.</p>
          </div>
        </header>
        <section
          v-for="section in brandStory"
          :key="section.id"
          :data-story="section.id"
          class="story-section"
          :class="{
            'story-harbor': section.id === 'harbor',
            'story-section-active': active === section.id,
          }"
          :aria-labelledby="`story-${section.id}`"
        >
          <button
            class="story-number"
            :aria-label="`Highlight ${section.title} in the icon`"
            :aria-pressed="active === section.id"
            @click="selectSection(section.id)"
          >
            {{ section.number }}
          </button>
          <div class="story-section-body">
            <h4 :id="`story-${section.id}`" class="story-section-title">{{ section.title }}</h4>
            <p v-for="paragraph in section.paragraphs" :key="paragraph" class="story-paragraph">
              {{ paragraph }}
            </p>
            <div class="story-sources">
              <AppTooltip :text="'Read the historical source in your browser.'" v-for="source in section.sources" :key="source.url"><a
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
                
                @click="openSource($event, source.url)"
              >
                {{ source.label }}<AppIcon name="ArrowUpRight" :size="12" />
              </a></AppTooltip>
            </div>
          </div>
        </section>
      </div>
      <aside class="story-map-panel" aria-label="Explore the four details in the icon">
        <BrandStoryMap :active="active" @select="selectSection" />
      </aside>
    </div>
    <p class="story-note">
      Our icon and illustration interpret these places. Shapes, distances and colors are simplified
      to tell their story at a small scale.
    </p>
  </article>
</template>

<style scoped>
.brand-story {
  padding: 0 10px 8px;
}
.story-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  padding: 6px 0;
  font-size: 12px;
}
.story-back:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.story-introduction {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  align-items: center;
  padding: 20px 0 28px;
}
.story-eyebrow {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
  letter-spacing: 0.3px;
}
.story-title {
  max-width: 360px;
  margin: 12px 0;
  font-size: 29px;
  font-weight: 550;
  line-height: 1.18;
  letter-spacing: -0.8px;
  outline: none;
}
.story-deck {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}
.story-icon {
  display: block;
  width: 120px;
  height: 120px;
}
.story-section {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  padding: 25px 0;
  border-top: 1px solid var(--line);
}
.story-section:last-child {
  min-height: var(--story-final-height);
}
.story-number {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 0;
  line-height: 24px;
  background: transparent;
  color: var(--muted);
  align-self: start;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.story-section {
  --story-color: var(--accent);
}
.story-section[data-story='gate'] {
  --story-color: #929b95;
}
.story-section[data-story='oak'] {
  --story-color: #68976b;
}
.story-section[data-story='tram'] {
  --story-color: #e4a23b;
}
.story-section-title {
  font-size: 17px;
  line-height: 1.4;
  font-weight: 550;
  letter-spacing: -0.2px;
  margin: 0 0 14px;
}
.story-harbor .story-section-title {
  font-size: 20px;
}
.story-paragraph {
  font-size: 14px;
  line-height: 1.8;
}
.story-paragraph + .story-paragraph {
  margin-top: 13px;
}
.story-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 15px;
}
.story-sources a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: 11px;
  line-height: 1.6;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
}
.story-sources a:hover {
  text-decoration-color: currentColor;
}
.story-sources a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: 2px;
}
.story-note {
  border-top: 1px solid var(--line);
  padding-top: 20px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
@media (max-width: 620px) {
  .brand-story {
    padding-inline: 0;
  }
  .story-introduction {
    grid-template-columns: minmax(0, 1fr) 80px;
    gap: 12px;
  }
  .story-icon {
    width: 80px;
    height: 80px;
  }
  .story-title {
    font-size: 24px;
  }
  .story-section {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}

.story-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 32px;
  align-items: start;
}
.story-map-panel {
  position: sticky;
  top: 85px;
  padding-top: 16px;
}
.story-section-active .story-number {
  color: var(--text);
  background: transparent;
}
.story-section-active .story-number::before {
  content: '';
  position: absolute;
  left: 0;
  top: 5px;
  width: 2px;
  height: 14px;
  border-radius: 1px;
  background: var(--story-color);
}
.story-number:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (max-width: 900px) {
  .story-layout {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 20px;
  }
}
@media (max-width: 650px) {
  .story-layout {
    display: flex;
    flex-direction: column;
  }
  .story-map-panel {
    position: static;
    order: -1;
    width: min(100%, 330px);
    margin-inline: auto;
  }
}
</style>
