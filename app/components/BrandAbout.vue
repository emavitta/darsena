<script setup lang="ts">
const { platformName, appVersion } = usePlatform()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <AppDialog title="About Darsena" wide @close="emit('close')">
    <div class="brand-about">
      <BrandIdentity :caption="`Version ${appVersion} · ${platformName}`" />
      <HarborArtwork />
      <p class="about-description">
        Named after Milan’s Darsena.<br />A harbor for your projects and worktrees.
      </p>
    </div>
  </AppDialog>
</template>

<style scoped>
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
</style>
