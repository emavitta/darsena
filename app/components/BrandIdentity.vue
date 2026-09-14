<script setup lang="ts">
defineProps<{ caption?: string; story?: boolean }>()
const emit = defineEmits<{ story: [] }>()
</script>

<template>
  <div class="brand-identity">
    <AppTooltip :text="'Discover the harbor, gate, oak and tram in the Darsena icon.'" v-if="story"><button
      
      class="brand-icon-button"
      aria-label="Read the story of Darsena"
      
      @click="emit('story')"
    >
      <img class="brand-identity-icon" src="/brand/icon.png" width="112" height="112" alt="" />
    </button></AppTooltip>
    <img v-else class="brand-identity-icon" src="/brand/icon.png" width="112" height="112" alt="" />
    <div>
      <p class="brand-wordmark">darsena</p>
      <p v-if="caption" class="brand-caption">{{ caption }}</p>
    </div>
  </div>
</template>

<style scoped>
.brand-identity {
  display: flex;
  align-items: center;
  gap: 22px;
}
.brand-identity-icon {
  display: block;
  width: var(--brand-icon-size, 112px);
  height: var(--brand-icon-size, 112px);
  flex-shrink: 0;
}
.brand-icon-button {
  display: block;
  padding: 0;
  flex-shrink: 0;
  border-radius: 23%;
}
.brand-icon-button:hover {
  background: var(--accent-soft);
}
.brand-wordmark {
  font-size: var(--brand-wordmark-size, 48px);
  line-height: 1;
  font-weight: 600;
  letter-spacing: -2px;
}
.brand-caption {
  margin-top: 12px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
