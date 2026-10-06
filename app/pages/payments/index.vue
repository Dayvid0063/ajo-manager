<!-- app/pages/payments/index.vue -->
<!-- Everything I owe (open) and my full payment history (all), across groups. -->
<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-extrabold tracking-tight">Payments</h1>

    <div role="tablist" class="flex gap-1 rounded-xl border border-border bg-surface-muted p-1">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="filter === tab.value"
        class="min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold"
        :class="filter === tab.value ? 'bg-surface text-primary shadow-card' : 'text-text-muted hover:text-text'"
        @click="filter = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <AppCard v-if="!items.length" class="flex flex-col items-center gap-3 py-10 text-center">
      <span class="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon name="i-lucide-hand-coins" class="size-7" aria-hidden="true" />
      </span>
      <p class="font-semibold">{{ status === 'pending' ? 'Loading…' : filter === 'open' ? 'Nothing to pay right now' : 'No payments yet' }}</p>
      <p class="max-w-sm text-text-muted">Payments appear here once a group you belong to has started.</p>
    </AppCard>

    <ul v-else class="flex flex-col gap-2">
      <li v-for="item in items" :key="item.id">
        <NuxtLink
          :to="`/payments/${item.id}`"
          class="flex items-center gap-3 rounded-card border bg-surface p-4 shadow-card hover:border-primary/40"
          :class="item.displayStatus === 'submitted' ? 'border-2 border-dashed border-status-submitted/70' : 'border-border'"
        >
          <div class="min-w-0 flex-1">
            <p class="font-bold"><MoneyText :kobo="item.amount" /> <span class="font-semibold text-text-muted">to {{ item.recipientName }}</span></p>
            <p class="truncate text-sm text-text-muted">{{ item.groupName }} · Round {{ item.roundIndex }} · {{ formatLagosDate(item.dueDate, 'medium') }}</p>
          </div>
          <StatusChip :status="item.displayStatus" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
useHead({ title: 'Payments · Ajo Manager' })

const TABS = [
  { value: 'open', label: 'To pay' },
  { value: 'all', label: 'All payments' }
]
const filter = ref('open')
const { data, status } = await useFetch('/api/me/obligations', { query: { filter } })
const items = computed(() => data.value?.items ?? [])
</script>
