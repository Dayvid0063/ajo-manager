<!-- app/pages/admin/audit.vue -->
<!-- Read-only audit log. Entries can't be edited or deleted by anyone. -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Audit log</h1>
      <p class="text-text-muted">Every important action, newest first. Read-only.</p>
    </div>

    <form class="flex flex-wrap gap-2" @submit.prevent="applyFilter">
      <label class="flex flex-col gap-1.5 text-sm font-semibold">
        Action
        <select v-model="actionInput" class="min-h-12 rounded-xl border border-border bg-surface px-3 font-semibold">
          <option v-for="option in ACTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <AppButton type="submit" icon="i-lucide-filter" class="self-end">Filter</AppButton>
      <AppButton v-if="route.query.group" variant="ghost" class="self-end" @click="navigateTo('/admin/audit')">Clear group filter</AppButton>
    </form>
    <AppAlert v-if="route.query.group" tone="info">Showing one group only.</AppAlert>

    <AppCard class="p-0 sm:p-0">
      <p v-if="!items.length" class="px-4 py-10 text-center text-text-muted">{{ status === 'pending' ? 'Loading…' : 'No entries.' }}</p>
      <ol v-else class="divide-y divide-border">
        <li v-for="entry in items" :key="entry.id" class="flex flex-col gap-1 px-4 py-3.5 sm:px-5">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p><code class="rounded bg-surface-muted px-1.5 py-0.5 text-sm font-bold">{{ entry.action }}</code> by <strong>{{ entry.actorName }}</strong></p>
            <p class="text-xs text-text-muted">{{ formatLagosDateTime(entry.createdAt) }}</p>
          </div>
          <p v-if="entry.groupName" class="text-sm text-text-muted">
            Group: <NuxtLink :to="`/admin/groups/${entry.groupId}`" class="font-semibold hover:underline">{{ entry.groupName }}</NuxtLink>
          </p>
          <p v-if="entry.reason" class="text-sm">Reason: {{ entry.reason }}</p>
          <details v-if="entry.before || entry.after" class="text-sm">
            <summary class="cursor-pointer font-semibold text-text-muted">Details</summary>
            <pre class="mt-2 overflow-x-auto rounded-xl bg-surface-muted p-3 text-xs">{{ JSON.stringify({ before: entry.before, after: entry.after, entity: `${entry.entityType}:${entry.entityId}`, requestId: entry.correlationId }, null, 2) }}</pre>
          </details>
        </li>
      </ol>
    </AppCard>

    <div v-if="data && data.total > data.limit" class="flex items-center justify-between">
      <AppButton variant="secondary" :disabled="page <= 1" @click="page--">Newer</AppButton>
      <span class="text-sm text-text-muted">Page {{ page }} of {{ Math.ceil(data.total / data.limit) }}</span>
      <AppButton variant="secondary" :disabled="page * data.limit >= data.total" @click="page++">Older</AppButton>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
useHead({ title: 'Audit log · Platform admin' })

const ACTIONS = [
  { value: '', label: 'All actions' },
  { value: 'group.', label: 'Groups' },
  { value: 'fee.', label: 'Platform fees' },
  { value: 'membership.', label: 'Membership' },
  { value: 'position', label: 'Positions' },
  { value: 'rules.', label: 'Rules' },
  { value: 'payment.', label: 'Payments' },
  { value: 'dispute.', label: 'Disputes' },
  { value: 'cycle.', label: 'Cycle' },
  { value: 'user.', label: 'Users' }
]

const route = useRoute()
const actionInput = ref('')
const action = ref('')
const page = ref(1)
const group = computed(() => (typeof route.query.group === 'string' ? route.query.group : undefined))

const { data, status } = await useFetch('/api/admin/audit', { query: { action, page, group } })
const items = computed(() => data.value?.items ?? [])

function applyFilter() {
  page.value = 1
  action.value = actionInput.value
}
</script>
