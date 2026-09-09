<template>
  <section class="brand-splash" aria-label="Opening Darsena" aria-busy="true">
    <BrandIdentity caption="A harbor for your worktrees." />
    <p class="splash-status" role="status">Opening your harbor…</p>
  </section>
</template>

<style scoped>
.brand-splash {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 36px;
  --brand-icon-size: 144px;
  --brand-wordmark-size: 54px;
}
.splash-status {
  color: var(--muted);
  font-size: 13px;
}
</style>
