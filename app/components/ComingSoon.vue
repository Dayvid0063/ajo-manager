<!-- app/components/ComingSoon.vue -->
<!-- PLACEHOLDER: marks screens that are built in a later phase. -->
<template>
  <div>
    <h1 class="mb-4 text-2xl font-extrabold tracking-tight">{{ title }}</h1>
    <AppCard class="flex flex-col items-center gap-3 py-10 text-center">
      <span class="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon :name="icon" class="size-7" aria-hidden="true" />
      </span>
      <p class="font-semibold">This screen is coming in Phase {{ phase }}.</p>
      <p class="max-w-sm text-text-muted">{{ description }}</p>
    </AppCard>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  phase: { type: [String, Number], required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'i-lucide-hammer' }
})
</script>
