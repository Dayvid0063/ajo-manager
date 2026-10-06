<!-- app/components/ui/StatusChip.vue -->
<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold"
    :class="style.classes"
  >
    <Icon :name="style.icon" class="size-4 shrink-0" aria-hidden="true" />
    <span>{{ label || style.label }}</span>
  </span>
</template>

<script setup>
import { getStatusStyle } from '~/utils/status'

const props = defineProps({
  status: { type: String, required: true },
  label: { type: String, default: '' }
})

const style = computed(() => getStatusStyle(props.status))
</script>
