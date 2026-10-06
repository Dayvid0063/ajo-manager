<!-- app/components/ui/ThemeToggle.vue -->
<template>
  <!-- Preference is read from the browser, so render client-side to avoid a hydration mismatch -->
  <ClientOnly>
    <div role="radiogroup" aria-label="Theme" class="inline-flex rounded-xl border border-border bg-surface-muted p-1">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="colorMode.preference === option.value"
        :title="option.label"
        class="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors"
        :class="colorMode.preference === option.value ? 'bg-surface text-primary shadow-card' : 'text-text-muted hover:text-text'"
        @click="colorMode.preference = option.value"
      >
        <Icon :name="option.icon" class="size-4" aria-hidden="true" />
        <span :class="compact && 'sr-only'">{{ option.label }}</span>
      </button>
    </div>
    <template #fallback>
      <div class="h-12 rounded-xl border border-border bg-surface-muted" :class="compact ? 'w-32' : 'w-64'" aria-hidden="true" />
    </template>
  </ClientOnly>
</template>

<script setup>
defineProps({
  compact: { type: Boolean, default: false }
})

const colorMode = useColorMode()

const options = [
  { value: 'system', label: 'System', icon: 'i-lucide-monitor-smartphone' },
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' }
]
</script>
