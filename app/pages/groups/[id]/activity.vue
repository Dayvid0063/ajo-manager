<!-- app/pages/groups/[id]/activity.vue -->
<!-- Group activity log (read-only), for the owner and admins. -->
<template>
  <AppCard class="p-0 sm:p-0">
    <p v-if="!items.length" class="px-4 py-10 text-center text-text-muted">
      {{ status === 'pending' ? 'Loading…' : 'No activity yet.' }}
    </p>
    <ol v-else class="divide-y divide-border">
      <li v-for="item in items" :key="item.id" class="flex gap-3 px-4 py-3.5 sm:px-5">
        <span class="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted">
          <Icon :name="iconFor(item.action)" class="size-4" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <p><strong>{{ item.actorName }}</strong> {{ item.summary }}</p>
          <p v-if="item.reason" class="text-sm text-text-muted">Reason: {{ item.reason }}</p>
          <p class="text-xs text-text-muted">{{ formatLagosDateTime(item.createdAt) }}</p>
        </div>
      </li>
    </ol>
    <div v-if="data && data.total > items.length" class="border-t border-border p-3 text-center">
      <AppButton variant="ghost" @click="limit += 20">Show more</AppButton>
    </div>
  </AppCard>
</template>

<script setup>
const route = useRoute()
const limit = ref(20)

const { data, status } = await useFetch(() => `/api/groups/${route.params.id}/activity`, { query: { limit } })
const items = computed(() => data.value?.items ?? [])

function iconFor(action = '') {
  if (action.startsWith('fee.')) return 'i-lucide-receipt'
  if (action.startsWith('rules.')) return 'i-lucide-scroll-text'
  if (action === 'group.cancelled') return 'i-lucide-ban'
  if (action === 'group.created') return 'i-lucide-sparkles'
  return 'i-lucide-pencil'
}
</script>
