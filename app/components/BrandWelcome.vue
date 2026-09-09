<script setup lang="ts">
defineProps<{ desktopOnly?: boolean; busy?: boolean }>()
const emit = defineEmits<{ add: [] }>()
</script>

<template>
  <section class="brand-welcome">
    <div class="welcome-composition">
      <BrandIdentity caption="A harbor for your worktrees." />
      <HarborArtwork />
      <div class="welcome-introduction">
        <div>
          <h1>Your worktrees,<br />in one place.</h1>
          <p v-if="desktopOnly">Open the desktop app to connect your local projects.</p>
          <p v-else>Switch worktrees. Open your tools.<br />See what’s running, and where.</p>
        </div>
        <div v-if="!desktopOnly" class="welcome-action">
          <button
            v-tooltip="'Choose a local Git repository. Darsena discovers its existing worktrees.'"
            class="button primary large"
            :disabled="busy"
            @click="emit('add')"
          >
            <AppIcon name="Plus" :size="16" />Add your first project
          </button>
          <span>Start with a local Git repository.</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.brand-welcome {
  flex: 1;
  min-width: 0;
  overflow: auto;
  display: grid;
  place-items: center;
  padding: 36px clamp(32px, 5vw, 80px);
}
.welcome-composition {
  width: 100%;
  max-width: 780px;
}
.welcome-composition > .harbor-artwork {
  margin-top: 28px;
}
.welcome-introduction {
  padding-top: 28px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
}
h1 {
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 550;
  line-height: 1.15;
  letter-spacing: -1.4px;
}
p {
  margin-top: 14px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}
.welcome-action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 4px;
}
.welcome-action span {
  color: var(--muted);
  font-size: 12px;
}
@media (max-height: 760px) {
  .brand-welcome {
    padding-top: 24px;
    padding-bottom: 24px;
    --brand-icon-size: 88px;
    --brand-wordmark-size: 40px;
  }
  .welcome-composition > .harbor-artwork {
    width: min(100%, 460px);
    margin-top: 20px;
  }
  .welcome-introduction {
    padding-top: 20px;
  }
  h1 {
    font-size: 28px;
  }
  p {
    margin-top: 10px;
  }
}
@media (max-width: 800px) {
  .welcome-introduction {
    align-items: flex-start;
    flex-direction: column;
    gap: 24px;
  }
}
</style>
