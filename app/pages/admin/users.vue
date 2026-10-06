<!-- app/pages/admin/users.vue -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Users</h1>
      <p class="text-text-muted">Look up a user and, after confirming their identity, issue a temporary password.</p>
    </div>

    <form class="flex gap-2" role="search" @submit.prevent="runSearch">
      <div class="flex-1">
        <AppInput v-model="search" label="Search by email or name" type="search" placeholder="e.g. ada@example.com" />
      </div>
      <AppButton type="submit" icon="i-lucide-search" class="self-end" :loading="status === 'pending'">Search</AppButton>
    </form>

    <!-- Shown once, right after issuing -->
    <AppCard v-if="issued" class="flex flex-col gap-3 border-status-due/40">
      <h2 class="flex items-center gap-2 font-bold">
        <Icon name="i-lucide-key-round" class="size-5 text-status-due" aria-hidden="true" />
        Temporary password for {{ issued.email }}
      </h2>
      <div class="flex items-center gap-2">
        <code class="tabular flex-1 rounded-xl bg-surface-muted px-4 py-3 text-xl font-bold tracking-wider">{{ issued.password }}</code>
        <AppButton variant="secondary" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy">
          {{ copied ? 'Copied' : 'Copy' }}
        </AppButton>
      </div>
      <AppAlert tone="warning">
        This is the only time it is shown. Give it to the user privately — never in a group chat. They must choose a new password when they log in, and all their devices have been logged out.
      </AppAlert>
      <AppButton variant="ghost" class="self-start" @click="issued = null">Done</AppButton>
    </AppCard>

    <AppAlert v-if="actionError" tone="error">{{ actionError }}</AppAlert>

    <AppCard class="p-0 sm:p-0">
      <p v-if="!data?.items.length" class="px-4 py-10 text-center text-text-muted">
        {{ status === 'pending' ? 'Loading…' : 'No users found.' }}
      </p>
      <ul v-else class="divide-y divide-border">
        <li v-for="item in data.items" :key="item.id" class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-2 font-semibold">
              {{ item.name || 'No name yet' }}
              <span v-if="item.isPlatformAdmin" class="rounded-full bg-status-fee-soft px-2 py-0.5 text-xs font-bold text-status-fee">Platform admin</span>
              <span v-if="item.mustChangePassword" class="rounded-full bg-status-due-soft px-2 py-0.5 text-xs font-bold text-status-due">Temporary password</span>
            </p>
            <p class="truncate text-sm text-text-muted">{{ item.email }}</p>
            <p class="text-xs text-text-muted">
              Joined {{ formatDate(item.createdAt) }} · Last login {{ item.lastLoginAt ? formatDate(item.lastLoginAt) : 'never' }}
            </p>
          </div>
          <AppButton
            v-if="item.id !== user?.id"
            variant="secondary"
            icon="i-lucide-key-round"
            :loading="issuingId === item.id"
            @click="issue(item)"
          >
            Issue temporary password
          </AppButton>
        </li>
      </ul>
    </AppCard>

    <div v-if="data && data.total > data.limit" class="flex items-center justify-between">
      <AppButton variant="secondary" :disabled="page <= 1" @click="page--">Previous</AppButton>
      <span class="text-sm text-text-muted">Page {{ page }} of {{ totalPages }}</span>
      <AppButton variant="secondary" :disabled="page >= totalPages" @click="page++">Next</AppButton>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
useHead({ title: 'Users · Platform admin' })

const { user } = useUserSession()

const search = ref('')
const query = ref('')
const page = ref(1)

const { data, status, refresh } = await useFetch('/api/admin/users', {
  query: { q: query, page }
})

const totalPages = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.limit)) : 1))

function runSearch() {
  page.value = 1
  query.value = search.value.trim()
}

const issued = ref(null)
const issuingId = ref('')
const actionError = ref('')
const copied = ref(false)

async function issue(item) {
  const ok = window.confirm(
    `Issue a temporary password for ${item.email}?\n\nOnly do this after confirming their identity. Their current password stops working and they are logged out everywhere.`
  )
  if (!ok) return
  actionError.value = ''
  issuingId.value = item.id
  try {
    const result = await $fetch(`/api/admin/users/${item.id}/temporary-password`, { method: 'POST' })
    issued.value = { email: item.email, password: result.temporaryPassword }
    copied.value = false
    await refresh()
  } catch (error) {
    actionError.value = error?.data?.message || 'Could not issue a temporary password.'
  } finally {
    issuingId.value = ''
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(issued.value.password)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeZone: 'Africa/Lagos' }).format(new Date(value))
}
</script>
