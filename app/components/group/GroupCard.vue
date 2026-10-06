<!-- app/components/group/GroupCard.vue -->
<template>
  <NuxtLink
    :to="`/groups/${group.id}`"
    class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/40 sm:p-5"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-lg font-bold">{{ group.name }}</p>
        <p class="text-sm text-text-muted">{{ ROLE_LABELS[group.myRole] ?? 'Member' }} · {{ group.plannedMemberCount }} members</p>
      </div>
      <StatusChip v-bind="GROUP_STATUS_CHIPS[group.status] ?? GROUP_STATUS_CHIPS.draft" />
    </div>
    <p class="text-text-muted">
      <strong class="text-text"><MoneyText :kobo="group.contributionAmount" /></strong>
      {{ FREQUENCY_LABELS[group.frequency]?.toLowerCase() }} ·
      payout <strong class="text-status-payout"><MoneyText :kobo="group.summary?.payoutPerRound ?? 0" /></strong>
    </p>
    <p v-if="group.isOwner && group.status === 'draft'" class="flex items-center gap-1.5 text-sm font-semibold text-status-due">
      <Icon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
      {{ group.feeStatus === 'pending' ? 'Waiting for fee verification' : 'Next: pay the platform fee' }}
    </p>
  </NuxtLink>
</template>

<script setup>
import { FREQUENCY_LABELS, GROUP_STATUS_CHIPS, ROLE_LABELS } from '~/utils/labels'

defineProps({
  group: { type: Object, required: true }
})
</script>
