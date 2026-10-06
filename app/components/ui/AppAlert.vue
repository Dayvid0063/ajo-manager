<!-- app/components/ui/AppAlert.vue -->
<template>
  <div
    :role="tone === 'error' ? 'alert' : 'status'"
    class="flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium"
    :class="tones[tone].classes"
  >
    <Icon :name="tones[tone].icon" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div><slot /></div>
  </div>
</template>

<script setup>
defineProps({
  tone: { type: String, default: 'info' }
})

const tones = {
  info: { icon: 'i-lucide-info', classes: 'border-status-submitted/30 bg-status-submitted-soft text-status-submitted' },
  success: { icon: 'i-lucide-circle-check', classes: 'border-status-confirmed/30 bg-status-confirmed-soft text-status-confirmed' },
  warning: { icon: 'i-lucide-triangle-alert', classes: 'border-status-due/30 bg-status-due-soft text-status-due' },
  error: { icon: 'i-lucide-circle-alert', classes: 'border-status-rejected/30 bg-status-rejected-soft text-status-rejected' }
}
</script>
