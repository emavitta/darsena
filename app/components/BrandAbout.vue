<script setup lang="ts">
const props = defineProps<{ initialStory?: boolean }>()
const emit = defineEmits<{ close: []; openUrl: [url: string] }>()
const story = shallowRef(Boolean(props.initialStory))
const readStory = useTemplateRef('readStory')
const content = useTemplateRef('content')

async function backToAbout() {
  story.value = false
  await nextTick()
  readStory.value?.focus({ preventScroll: true })
  readStory.value?.closest('dialog')?.scrollTo({ top: 0 })
}

async function showStory() {
  story.value = true
  await nextTick()
  content.value?.closest('dialog')?.scrollTo({ top: 0 })
}
</script>

<template>
  <AppDialog
    :title="story ? 'The story of Darsena' : 'About Darsena'"
    class="brand-about-dialog"
    :class="{ 'reading-story': story }"
    wide
    @close="emit('close')"
  >
    <div ref="content">
      <BrandStory v-if="story" @back="backToAbout" @open-url="emit('openUrl', $event)" />
      <div v-else class="brand-about">
        <BrandIdentity caption="Version 0.1 · Made for macOS" story @story="showStory" />
        <HarborArtwork />
        <div class="about-description">
          <p>
            Named after Milan’s inland harbor, where waterways brought materials and people
            together. A place to gather your projects, find your worktrees and see what’s running.
          </p>
          <button ref="readStory" class="about-story-link" @click="showStory">
            The story behind the name &amp; icon<AppIcon name="ArrowRight" :size="15" />
          </button>
        </div>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.brand-about-dialog.reading-story {
  width: 1040px;
}
.brand-about-dialog :deep(.dialog-header) {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg);
}
.brand-about {
  display: grid;
  gap: 24px;
  --brand-icon-size: 104px;
  --brand-wordmark-size: 42px;
}
.about-description {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}
.about-story-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  margin-top: 12px;
  padding: 5px 0;
  text-align: left;
  line-height: 1.6;
}
.about-story-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
