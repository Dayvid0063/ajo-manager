<!-- app/pages/admin/index.vue -->
<!-- Platform admin overview. More metrics arrive in Phase 6. -->
<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-extrabold tracking-tight">Platform admin</h1>

    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink to="/admin/fees" class="flex items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card hover:border-status-fee/40">
        <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-status-fee-soft text-status-fee">
          <Icon name="i-lucide-receipt" class="size-6" aria-hidden="true" />
        </span>
        <div>
          <p class="tabular text-3xl font-extrabold">{{ pendingFees ?? '—' }}</p>
          <p class="text-text-muted">platform fees to verify</p>
        </div>
      </NuxtLink>
      <NuxtLink to="/admin/users" class="flex items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card hover:border-primary/40">
        <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon name="i-lucide-users" class="size-6" aria-hidden="true" />
        </span>
        <div>
          <p class="font-bold">Users</p>
          <p class="text-text-muted">Look up users, issue temporary passwords</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
useHead({ title: 'Platform admin · Ajo Manager' })

const { data } = await useFetch('/api/admin/fees', { query: { status: 'pending', limit: 1 } })
const pendingFees = computed(() => data.value?.total)
</script>
