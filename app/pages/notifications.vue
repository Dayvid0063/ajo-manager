<!-- app/pages/notifications.vue -->
<!-- In-app notification feed (the only channel in v1). -->
<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-extrabold tracking-tight">Alerts</h1>
      <AppButton v-if="unread" variant="ghost" icon="i-lucide-check-check" :loading="markingAll" @click="markAll">Mark all as read</AppButton>
    </div>

    <AppCard v-if="!items.length" class="flex flex-col items-center gap-3 py-10 text-center">
      <span class="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon name="i-lucide-bell" class="size-7" aria-hidden="true" />
      </span>
      <p class="font-semibold">{{ status === 'pending' ? 'Loading…' : 'No alerts yet' }}</p>
      <p class="max-w-sm text-text-muted">Reminders and updates from your groups will appear here.</p>
    </AppCard>

    <AppCard v-else class="p-0 sm:p-0">
      <ul class="divide-y divide-border">
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="flex w-full gap-3 px-4 py-4 text-left hover:bg-surface-muted sm:px-5"
            :class="!item.readAt && 'bg-primary-soft/40'"
            @click="open(item)"
          >
            <span class="mt-1.5 size-2.5 shrink-0 rounded-full" :class="item.readAt ? 'bg-transparent' : 'bg-primary'" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">
                {{ item.title }}
                <span v-if="!item.readAt" class="sr-only">(unread)</span>
              </span>
              <span class="block text-text-muted">{{ item.body }}</span>
              <span class="mt-1 block text-xs text-text-muted">{{ formatLagosDateTime(item.createdAt) }}</span>
            </span>
            <Icon v-if="item.data?.link" name="i-lucide-chevron-right" class="mt-1 size-5 shrink-0 text-text-muted" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div v-if="data && data.total > items.length" class="border-t border-border p-3 text-center">
        <AppButton variant="ghost" @click="limit += 20">Show more</AppButton>
      </div>
    </AppCard>
  </div>
</template>

<script setup>
useHead({ title: 'Alerts · Ajo Manager' })

const limit = ref(20)
const { data, status, refresh } = await useFetch('/api/notifications', { query: { limit } })
const items = computed(() => data.value?.items ?? [])
const unread = computed(() => data.value?.unread ?? 0)
const { refresh: refreshBadge } = useUnreadCount()

const markingAll = ref(false)

async function markAll() {
  markingAll.value = true
  try {
    await $fetch('/api/notifications/read', { method: 'POST', body: {} })
    await Promise.all([refresh(), refreshBadge()])
  } finally {
    markingAll.value = false
  }
}

async function open(item) {
  if (!item.readAt) {
    await $fetch('/api/notifications/read', { method: 'POST', body: { ids: [item.id] } })
    refreshBadge()
  }
  if (item.data?.link?.startsWith('/')) {
    await navigateTo(item.data.link)
  } else {
    await refresh()
  }
}
</script>
