<!-- app/pages/admin/disputes/index.vue -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Disputes</h1>
      <p class="text-text-muted">Disputes from every group. Group admins handle most of them; step in when needed.</p>
    </div>

    <div role="tablist" class="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-muted p-1">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="statusFilter === tab.value"
        class="min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold"
        :class="statusFilter === tab.value ? 'bg-surface text-primary shadow-card' : 'text-text-muted hover:text-text'"
        @click="statusFilter = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <AppCard class="p-0 sm:p-0">
      <p v-if="!items.length" class="px-4 py-10 text-center text-text-muted">{{ status === 'pending' ? 'Loading…' : 'No disputes here.' }}</p>
      <ul v-else class="divide-y divide-border">
        <li v-for="item in items" :key="item.id">
          <NuxtLink :to="`/admin/disputes/${item.id}`" class="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5">
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ item.categoryLabel }} <span class="font-normal text-text-muted">· {{ item.groupName }}</span></p>
              <p class="truncate text-sm text-text-muted">{{ item.openerName }} ({{ item.openerEmail }}) · {{ formatLagosDate(item.createdAt, 'medium') }} · {{ item.messages }} messages</p>
            </div>
            <StatusChip v-bind="DISPUTE_STATUS_CHIPS[item.status]" />
          </NuxtLink>
        </li>
      </ul>
    </AppCard>
  </div>
</template>

<script setup>
import { DISPUTE_STATUS_CHIPS } from '~/utils/labels'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Disputes · Platform admin' })

const TABS = [
  { value: 'active', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Closed' },
  { value: 'all', label: 'All' }
]
const statusFilter = ref('active')
const { data, status } = await useFetch('/api/admin/disputes', { query: { status: statusFilter } })
const items = computed(() => data.value?.items ?? [])
</script>
