<!-- app/components/ui/AppButton.vue -->
<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to || undefined"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled || loading"
    :aria-busy="loading || undefined"
    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    :class="[variants[variant], block && 'w-full']"
  >
    <Icon v-if="loading" name="i-lucide-loader-circle" class="size-5 animate-spin" aria-hidden="true" />
    <Icon v-else-if="icon" :name="icon" class="size-5" aria-hidden="true" />
    <slot />
  </component>
</template>

<script setup>
import { NuxtLink } from '#components'

defineProps({
  variant: { type: String, default: 'primary' },
  type: { type: String, default: 'button' },
  to: { type: [String, Object], default: null },
  icon: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false }
})

const variants = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-text hover:bg-surface-muted',
  ghost: 'text-primary hover:bg-primary-soft',
  danger: 'bg-status-rejected text-white hover:opacity-90'
}
</script>
