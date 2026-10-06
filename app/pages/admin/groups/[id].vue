<!-- app/pages/admin/groups/[id].vue -->
<!-- Read-only group view for platform admins. Nothing here changes group records. -->
<template>
  <div class="flex flex-col gap-5">
    <NuxtLink to="/admin/groups" class="inline-flex items-center gap-1 self-start text-sm font-semibold text-text-muted hover:text-text">
      <Icon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> Groups
    </NuxtLink>

    <AppAlert v-if="error" tone="error">Group not found.</AppAlert>

    <template v-else-if="data">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight">{{ data.group.name }}</h1>
          <p class="text-text-muted">Owner: {{ data.owner.name }} · {{ data.owner.email }} · code <span class="tabular">{{ data.inviteCode }}</span></p>
        </div>
        <StatusChip v-bind="GROUP_STATUS_CHIPS[data.group.status]" />
      </div>
      <AppAlert tone="info">Read-only. Platform admins cannot change contributions, positions or schedules.</AppAlert>

      <AppCard class="flex flex-col gap-4">
        <h2 class="font-bold">Settings</h2>
        <GroupSummary v-if="data.group.startDate" :settings="data.group" />
        <SummaryList
          v-if="data.fee"
          :items="[
            { key: 'fee', label: 'Platform fee', value: `${formatKobo(data.fee.amount)} · ${data.fee.status}` },
            { key: 'verified', label: 'Verified', value: data.fee.verifiedAt ? formatLagosDateTime(data.fee.verifiedAt) : '—' }
          ]"
        />
      </AppCard>

      <AppCard class="flex flex-col gap-3">
        <h2 class="font-bold">Members ({{ data.members.length }})</h2>
        <ul class="divide-y divide-border">
          <li v-for="member in data.members" :key="member.email" class="flex items-center gap-3 py-2.5">
            <span class="tabular w-8 font-bold text-text-muted">{{ member.position ?? '–' }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ member.name || '—' }} <span class="text-sm font-normal text-text-muted">· {{ ROLE_LABELS[member.role] }}</span></p>
              <p class="truncate text-sm text-text-muted">{{ member.email }}</p>
            </div>
            <span v-if="member.status === 'pending'" class="text-sm text-text-muted">Pending</span>
          </li>
        </ul>
      </AppCard>

      <AppCard v-if="data.rounds.length" class="flex flex-col gap-3">
        <h2 class="font-bold">Rounds</h2>
        <ul class="divide-y divide-border">
          <li v-for="round in data.rounds" :key="round.index" class="flex items-center gap-3 py-2.5">
            <span class="tabular w-8 font-bold text-text-muted">{{ round.index }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ round.recipientName }}</p>
              <p class="text-sm text-text-muted">{{ round.dueDate ? formatLagosDate(round.dueDate, 'medium') : '' }}</p>
            </div>
            <span class="tabular text-sm font-bold" :class="round.confirmed === round.total ? 'text-status-confirmed' : 'text-text-muted'">{{ round.confirmed }}/{{ round.total }}</span>
          </li>
        </ul>
      </AppCard>

      <AppCard v-if="data.disputes.length" class="flex flex-col gap-3">
        <h2 class="font-bold">Disputes</h2>
        <NuxtLink
          v-for="item in data.disputes"
          :key="item.id"
          :to="`/admin/disputes/${item.id}`"
          class="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 hover:bg-surface-muted"
        >
          <span>{{ formatLagosDate(item.createdAt, 'medium') }}</span>
          <StatusChip v-bind="DISPUTE_STATUS_CHIPS[item.status]" />
        </NuxtLink>
      </AppCard>

      <AppButton :to="{ path: '/admin/audit', query: { group: data.group.id } }" variant="secondary" icon="i-lucide-scroll-text" class="self-start">
        Audit log for this group
      </AppButton>
    </template>
  </div>
</template>

<script setup>
import { DISPUTE_STATUS_CHIPS, GROUP_STATUS_CHIPS, ROLE_LABELS } from '~/utils/labels'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Group · Platform admin' })

const route = useRoute()
const { data, error } = await useFetch(() => `/api/admin/groups/${route.params.id}`)
</script>
