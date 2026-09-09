<script setup lang="ts">
const props = defineProps<{ title: string; wide?: boolean; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const element = useTemplateRef('element')
const titleId = useId()
onMounted(() => element.value?.showModal())
</script>
<template>
  <dialog
    ref="element"
    class="dialog"
    :class="{ wide }"
    :aria-labelledby="titleId"
    :aria-busy="busy || undefined"
    @cancel.prevent="!busy && emit('close')"
    @click="
      (event) => {
        if (event.target === element && !busy) emit('close')
      }
    "
  >
    <header class="dialog-header">
      <h2 :id="titleId">{{ props.title }}</h2>
      <button
        v-tooltip="'Close this dialog.'"
        class="icon-button"
        aria-label="Close dialog"
        :disabled="busy"
        @click="emit('close')"
      >
        <AppIcon name="X" />
      </button>
    </header>
    <div class="dialog-body"><slot /></div>
  </dialog>
</template>
