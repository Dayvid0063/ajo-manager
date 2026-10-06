<!-- app/components/AppLogo.vue -->
<template>
  <span class="inline-flex items-center gap-2 font-extrabold tracking-tight text-text">
    <!-- A circle of members; the highlighted one is "this round's recipient" -->
    <svg viewBox="0 0 32 32" class="size-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" class="fill-primary" />
      <g class="fill-on-primary">
        <circle cx="16" cy="7.5" r="2.6" />
        <circle cx="23.4" cy="11.8" r="2.6" />
        <circle cx="23.4" cy="20.2" r="2.6" />
        <circle cx="8.6" cy="20.2" r="2.6" />
        <circle cx="8.6" cy="11.8" r="2.6" />
      </g>
      <circle cx="16" cy="24.5" r="3.1" class="fill-accent" />
    </svg>
    <span v-if="!iconOnly" class="text-lg">Ajo Manager</span>
  </span>
</template>

<script setup>
defineProps({
  iconOnly: { type: Boolean, default: false }
})
</script>
