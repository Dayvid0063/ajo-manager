<!-- app/pages/design.vue -->
<!-- Internal style guide (development only): shows every token and component
     in the current theme. Edit app/assets/css/tokens.css and watch it update. -->
<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Design system</h1>
        <p class="text-text-muted">Development only. Colors come from <code>tokens.css</code>.</p>
      </div>
      <ThemeToggle />
    </div>

    <section class="flex flex-col gap-3">
      <h2 class="font-bold">Brand &amp; surfaces</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="swatch in swatches" :key="swatch.name" class="overflow-hidden rounded-xl border border-border">
          <div class="h-14" :class="swatch.bg" />
          <p class="bg-surface px-3 py-2 text-sm font-semibold">{{ swatch.name }}</p>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-bold">Statuses</h2>
      <div class="flex flex-wrap gap-2">
        <StatusChip v-for="status in statuses" :key="status" :status="status" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-bold">Buttons</h2>
      <div class="flex flex-wrap gap-3">
        <AppButton>Primary</AppButton>
        <AppButton variant="secondary">Secondary</AppButton>
        <AppButton variant="ghost">Ghost</AppButton>
        <AppButton variant="danger">Reject</AppButton>
        <AppButton loading>Saving</AppButton>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-bold">Money</h2>
      <AppCard class="flex flex-col gap-1 text-lg">
        <p>Contribution: <strong><MoneyText :kobo="2000000" /></strong></p>
        <p>Platform fee: <strong class="text-status-fee"><MoneyText :kobo="370000" /></strong></p>
        <p>Payout: <strong class="text-status-payout"><MoneyText :kobo="18000000" /></strong></p>
      </AppCard>
    </section>
  </div>
</template>

<script setup>
// Removed from production builds by the pages:extend hook in nuxt.config.ts.
import { STATUS_STYLES } from '~/utils/status'

const statuses = Object.keys(STATUS_STYLES)

const swatches = [
  { name: 'primary', bg: 'bg-primary' },
  { name: 'primary-soft', bg: 'bg-primary-soft' },
  { name: 'accent', bg: 'bg-accent' },
  { name: 'accent-soft', bg: 'bg-accent-soft' },
  { name: 'bg', bg: 'bg-bg' },
  { name: 'surface', bg: 'bg-surface' },
  { name: 'surface-muted', bg: 'bg-surface-muted' },
  { name: 'border', bg: 'bg-border' }
]
</script>
