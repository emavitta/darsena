<script setup lang="ts">
import type { Ref } from 'vue'
defineProps<{ text?: string }>()
const open = shallowRef(false)
function dismiss(event: KeyboardEvent) {
  if (!open.value) return
  event.preventDefault()
  event.stopPropagation()
  open.value = false
}
const portal = inject<Ref<HTMLDialogElement | null | undefined>>(
  'darsena-dialog-element',
  shallowRef(undefined),
)
</script>
<template>
  <UTooltip
    v-model:open="open"
    :text="text"
    :portal="portal || true"
    :delay-duration="400"
    :content="{ side: 'top', onEscapeKeyDown: dismiss }"
    :ui="{ content: 'nuxt-ui-scope max-w-80', text: 'whitespace-pre-line' }"
    ><slot
  /></UTooltip>
</template>
