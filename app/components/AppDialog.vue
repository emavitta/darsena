<script setup lang="ts">
const props = defineProps<{ title: string; wide?: boolean; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const element = useTemplateRef('element')
provide('darsena-dialog-element', element)
const titleId = useId()
const backdropPress = shallowRef(false)
function backdropClick(event: MouseEvent) {
  // A tab can resize the dialog between pointerdown and click. Only an
  // interaction that started on the backdrop is an outside dismissal.
  const startedOutside = backdropPress.value
  backdropPress.value = false
  if (startedOutside && event.target === element.value && !props.busy) emit('close')
}
onMounted(() => element.value?.showModal())
// Closing before removal lets the native dialog restore focus to its opener.
onBeforeUnmount(() => element.value?.close())
</script>
<template>
  <dialog
    ref="element"
    class="dialog"
    :class="{ wide }"
    :aria-labelledby="titleId"
    :aria-busy="busy || undefined"
    @cancel.prevent="!busy && emit('close')"
    @pointerdown="backdropPress = $event.target === element"
    @pointercancel="backdropPress = false"
    @click="backdropClick"
  >
    <header class="dialog-header">
      <h2 :id="titleId">{{ props.title }}</h2>
      <AppTooltip :text="'Close this dialog.'"><button
        
        class="icon-button"
        aria-label="Close dialog"
        :disabled="busy"
        @click="emit('close')"
      >
        <AppIcon name="X" />
      </button></AppTooltip>
    </header>
    <div class="dialog-body"><slot /></div>
  </dialog>
</template>
