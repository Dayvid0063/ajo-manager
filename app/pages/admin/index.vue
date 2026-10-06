<!-- app/pages/admin/index.vue -->
<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-extrabold tracking-tight">Platform admin</h1>

    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink
        v-for="card in cards"
        :key="card.to"
        :to="card.to"
        class="flex items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card hover:border-primary/40"
      >
        <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl" :class="card.tone">
          <Icon :name="card.icon" class="size-6" aria-hidden="true" />
        </span>
        <div>
          <p class="tabular text-3xl font-extrabold">{{ card.value ?? '—' }}</p>
          <p class="text-text-muted">{{ card.label }}</p>
        </div>
      </NuxtLink>
    </div>

    <AppCard v-if="data">
      <h2 class="mb-3 font-bold">Groups by status</h2>
      <SummaryList :items="statusRows" />
    </AppCard>
  </div>
</template>

<script setup>
import { GROUP_STATUS_CHIPS } from '~/utils/labels'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Platform admin · Ajo Manager' })

const { data } = await useFetch('/api/admin/overview')

const cards = computed(() => [
  { to: '/admin/fees', label: 'platform fees to verify', value: data.value?.pendingFees, icon: 'i-lucide-receipt', tone: 'bg-status-fee-soft text-status-fee' },
  { to: '/admin/disputes', label: 'open disputes', value: data.value?.openDisputes, icon: 'i-lucide-flag', tone: 'bg-status-disputed-soft text-status-disputed' },
  { to: '/admin/groups', label: 'running groups', value: data.value?.groups.active ?? 0, icon: 'i-lucide-users-round', tone: 'bg-primary-soft text-primary' },
  { to: '/admin/users', label: 'registered users', value: data.value?.users, icon: 'i-lucide-users', tone: 'bg-surface-muted text-text-muted' }
])

const statusRows = computed(() =>
  Object.entries(GROUP_STATUS_CHIPS).map(([status, chip]) => ({ key: status, label: chip.label, value: String(data.value?.groups[status] ?? 0) }))
)
</script>
