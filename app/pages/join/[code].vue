<!-- app/pages/join/[code].vue -->
<!-- Invite link landing page: limited group summary, then sign in / request to join. -->
<template>
  <div class="flex flex-col gap-6">
    <AppAlert v-if="error" tone="error">
      {{ error.data?.message || 'We could not find that group.' }}
    </AppAlert>

    <template v-else-if="summary">
      <div>
        <p class="text-sm font-semibold text-primary">You're invited to join</p>
        <h1 class="text-3xl font-extrabold tracking-tight">{{ summary.name }}</h1>
        <p v-if="summary.ownerName" class="text-text-muted">Started by {{ summary.ownerName }}</p>
      </div>

      <AppCard class="flex flex-col gap-4">
        <p v-if="summary.description">{{ summary.description }}</p>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-surface-muted p-3">
            <p class="text-sm text-text-muted">Each member pays</p>
            <p class="text-lg font-extrabold"><MoneyText :kobo="summary.contributionAmount" /></p>
            <p class="text-sm text-text-muted">{{ FREQUENCY_LABELS[summary.frequency]?.toLowerCase() }}</p>
          </div>
          <div class="rounded-xl bg-status-payout-soft p-3">
            <p class="text-sm text-status-payout">Each payout</p>
            <p class="text-lg font-extrabold"><MoneyText :kobo="summary.payoutPerRound" /></p>
            <p class="text-sm text-text-muted">once per member</p>
          </div>
        </div>
        <SummaryList
          :items="[
            { key: 'members', label: 'Members', value: `${summary.approvedMemberCount} of ${summary.plannedMemberCount} joined` },
            { key: 'start', label: 'First payment due', value: summary.startDate ? formatLagosDate(summary.startDate) : '—' },
            { key: 'order', label: 'Payout order', value: POSITION_METHOD_LABELS[summary.positionMethod]?.title }
          ]"
        />
      </AppCard>

      <!-- What can I do? -->
      <AppAlert v-if="summary.myStatus === 'approved'" tone="success">You're already a member of this group.</AppAlert>
      <AppButton v-if="summary.myStatus === 'approved' && summary.groupId" :to="`/groups/${summary.groupId}`" block>Open group</AppButton>

      <AppCard v-else-if="summary.myStatus === 'pending'" class="flex flex-col items-center gap-2 border-2 border-dashed border-status-submitted text-center">
        <Icon name="i-lucide-hourglass" class="size-8 text-status-submitted" aria-hidden="true" />
        <p class="font-bold">Request sent</p>
        <p class="text-text-muted">The group owner or an admin will review it. We'll let you know in Alerts.</p>
      </AppCard>

      <AppAlert v-else-if="!summary.acceptingMembers" tone="warning">
        This group isn't taking new members right now — it's full or has already started.
      </AppAlert>

      <template v-else-if="!loggedIn">
        <AppButton :to="{ path: '/register', query: { redirect: route.fullPath } }" block>Create a free account to join</AppButton>
        <AppButton :to="{ path: '/login', query: { redirect: route.fullPath } }" variant="secondary" block>I already have an account</AppButton>
      </template>

      <template v-else>
        <AppAlert v-if="summary.myStatus === 'rejected'" tone="info">Your earlier request wasn't approved. You can ask again.</AppAlert>
        <AppAlert v-if="requestError" tone="error">{{ requestError }}</AppAlert>
        <p class="text-sm text-text-muted">
          By asking to join, you agree to share your name with this group. You'll read and accept the rules before the group starts.
        </p>
        <AppButton icon="i-lucide-user-plus" :loading="requesting" block @click="requestToJoin">Ask to join</AppButton>
      </template>
    </template>
  </div>
</template>

<script setup>
import { FREQUENCY_LABELS, POSITION_METHOD_LABELS } from '~/utils/labels'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const { loggedIn } = useUserSession()
const code = computed(() => String(route.params.code).toUpperCase())

const { data: summary, error, refresh } = await useFetch(() => `/api/join/${code.value}`)
useHead({ title: () => (summary.value ? `Join ${summary.value.name} · Ajo Manager` : 'Join a group · Ajo Manager') })

const requesting = ref(false)
const requestError = ref('')

async function requestToJoin() {
  requesting.value = true
  requestError.value = ''
  try {
    await $fetch(`/api/join/${code.value}`, { method: 'POST' })
    await refresh()
  } catch (err) {
    requestError.value = err?.data?.message || 'Could not send your request. Please try again.'
  } finally {
    requesting.value = false
  }
}
</script>
