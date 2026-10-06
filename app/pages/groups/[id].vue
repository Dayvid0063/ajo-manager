<!-- app/pages/groups/[id].vue -->
<!-- Group area shell: loads the group once, shows the header + tabs, and
     provides the data to child pages (overview, fee, rules, activity, settings). -->
<template>
  <div class="flex flex-col gap-5">
    <NuxtLink to="/groups" class="inline-flex items-center gap-1 self-start text-sm font-semibold text-text-muted hover:text-text">
      <Icon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> My groups
    </NuxtLink>

    <AppAlert v-if="error" tone="error">
      {{ error.statusCode === 404 ? 'This group does not exist or you are not a member.' : 'We could not load this group. Please refresh the page.' }}
    </AppAlert>

    <template v-else-if="group">
      <header class="flex flex-col gap-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-2xl font-extrabold tracking-tight">{{ group.name }}</h1>
            <p v-if="group.description" class="text-text-muted">{{ group.description }}</p>
          </div>
          <StatusChip v-bind="GROUP_STATUS_CHIPS[group.status] ?? GROUP_STATUS_CHIPS.draft" />
        </div>

        <nav aria-label="Group sections" class="-mx-4 overflow-x-auto px-4">
          <ul class="flex gap-1 border-b border-border">
            <li v-for="tab in tabs" :key="tab.to">
              <NuxtLink
                :to="tab.to"
                class="-mb-px flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-semibold text-text-muted hover:text-text"
                exact-active-class="!border-primary !text-primary"
              >
                <Icon :name="tab.icon" class="size-4" aria-hidden="true" />
                {{ tab.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </header>

      <NuxtPage />
    </template>
  </div>
</template>

<script setup>
import { GROUP_STATUS_CHIPS } from '~/utils/labels'

const route = useRoute()
const id = computed(() => route.params.id)

const { data, error, refresh } = await useFetch(() => `/api/groups/${id.value}`, { key: `group-${id.value}` })
const group = computed(() => data.value?.group ?? null)

useHead({ title: () => (group.value ? `${group.value.name} · Ajo Manager` : 'Group · Ajo Manager') })

const tabs = computed(() => {
  const g = group.value
  if (!g) return []
  const base = `/groups/${g.id}`
  const started = ['active', 'completed'].includes(g.status)
  return [
    { to: base, label: 'Overview', icon: 'i-lucide-layout-grid' },
    ...(started ? [{ to: `${base}/contributions`, label: 'Payments', icon: 'i-lucide-hand-coins' }] : []),
    ...(started ? [{ to: `${base}/schedule`, label: 'Schedule', icon: 'i-lucide-calendar-days' }] : []),
    ...(g.status !== 'draft' ? [{ to: `${base}/members`, label: 'Members', icon: 'i-lucide-users-round' }] : []),
    ...(g.canManage && g.status === 'awaiting_members' ? [{ to: `${base}/invite`, label: 'Invite', icon: 'i-lucide-user-plus' }] : []),
    { to: `${base}/rules`, label: 'Rules', icon: 'i-lucide-scroll-text' },
    ...(g.canManage ? [{ to: `${base}/fee`, label: 'Platform fee', icon: 'i-lucide-receipt' }] : []),
    ...(g.canManage ? [{ to: `${base}/activity`, label: 'Activity', icon: 'i-lucide-history' }] : []),
    ...(g.isOwner ? [{ to: `${base}/settings`, label: 'Settings', icon: 'i-lucide-settings' }] : [])
  ]
})

// Child pages read and refresh the group through this
provide('groupDetail', { data, refresh })
</script>
