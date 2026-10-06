<!-- app/pages/admin/groups/index.vue -->
<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-extrabold tracking-tight">Groups</h1>

    <form class="flex flex-wrap gap-2" role="search" @submit.prevent="runSearch">
      <div class="min-w-48 flex-1">
        <AppInput v-model="search" label="Search by name or invite code" type="search" />
      </div>
      <label class="flex flex-col gap-1.5 text-sm font-semibold">
        Status
        <select v-model="statusFilter" class="min-h-12 rounded-xl border border-border bg-surface px-3 font-semibold">
          <option value="all">All</option>
          <option v-for="(chip, value) in GROUP_STATUS_CHIPS" :key="value" :value="value">{{ chip.label }}</option>
        </select>
      </label>
      <AppButton type="submit" icon="i-lucide-search" class="self-end">Search</AppButton>
    </form>

    <AppCard class="p-0 sm:p-0">
      <p v-if="!items.length" class="px-4 py-10 text-center text-text-muted">{{ status === 'pending' ? 'Loading…' : 'No groups found.' }}</p>
      <ul v-else class="divide-y divide-border">
        <li v-for="item in items" :key="item.id">
          <NuxtLink :to="`/admin/groups/${item.id}`" class="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5">
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ item.name }} <span class="tabular text-sm text-text-muted">· {{ item.inviteCode }}</span></p>
              <p class="truncate text-sm text-text-muted">{{ item.ownerName }} · {{ item.ownerEmail }} · {{ item.members }} members</p>
            </div>
            <StatusChip v-bind="GROUP_STATUS_CHIPS[item.status]" />
          </NuxtLink>
        </li>
      </ul>
    </AppCard>

    <div v-if="data && data.total > data.limit" class="flex items-center justify-between">
      <AppButton variant="secondary" :disabled="page <= 1" @click="page--">Previous</AppButton>
      <span class="text-sm text-text-muted">Page {{ page }} of {{ Math.ceil(data.total / data.limit) }}</span>
      <AppButton variant="secondary" :disabled="page * data.limit >= data.total" @click="page++">Next</AppButton>
    </div>
  </div>
</template>

<script setup>
import { GROUP_STATUS_CHIPS } from '~/utils/labels'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Groups · Platform admin' })

const search = ref('')
const q = ref('')
const statusFilter = ref('all')
const page = ref(1)
watch(statusFilter, () => (page.value = 1))

const { data, status } = await useFetch('/api/admin/groups', { query: { q, status: statusFilter, page } })
const items = computed(() => data.value?.items ?? [])

function runSearch() {
  page.value = 1
  q.value = search.value.trim()
}
</script>
