<!-- app/components/ui/AppCard.vue -->
<template>
  <component :is="as" class="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
    <slot />
  </component>
</template>

<script setup>
defineProps({
  as: { type: String, default: 'section' }
})
</script>
