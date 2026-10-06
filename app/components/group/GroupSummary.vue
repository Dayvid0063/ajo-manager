<!-- app/components/group/GroupSummary.vue -->
<!-- Contribution + payout summary, computed with the same shared math the server uses. -->
<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl bg-surface-muted p-3.5">
        <p class="text-sm text-text-muted">Each member pays</p>
        <p class="text-xl font-extrabold">
          <MoneyText :kobo="settings.contributionAmount" />
          <span class="text-base font-semibold text-text-muted"> / {{ FREQUENCY_PERIOD[settings.frequency] }}</span>
        </p>
      </div>
      <div class="rounded-xl border border-status-payout/30 bg-status-payout-soft p-3.5">
        <p class="text-sm text-status-payout">Each payout</p>
        <p class="text-xl font-extrabold"><MoneyText :kobo="summary.payoutPerRound" /></p>
      </div>
    </div>

    <SummaryList :items="rows" />

    <p class="rounded-xl bg-surface-muted p-3.5 text-sm text-text-muted">
      <Icon name="i-lucide-calculator" class="mr-1 inline size-4 align-text-bottom" aria-hidden="true" />
      {{ explanation }}
    </p>
  </div>
</template>

<script setup>
import { FREQUENCY_LABELS, FREQUENCY_PERIOD, POSITION_METHOD_LABELS } from '~/utils/labels'

const props = defineProps({
  // { contributionAmount, frequency, startDate, plannedMemberCount, recipientContributes, positionMethod }
  settings: { type: Object, required: true }
})

const summary = computed(() =>
  scheduleSummary({
    contributionAmount: props.settings.contributionAmount,
    memberCount: props.settings.plannedMemberCount,
    recipientContributes: props.settings.recipientContributes,
    frequency: props.settings.frequency,
    startDate: props.settings.startDate
  })
)

const rows = computed(() => [
  { key: 'frequency', label: 'How often', value: FREQUENCY_LABELS[props.settings.frequency] },
  { key: 'members', label: 'Members', value: `${props.settings.plannedMemberCount} people · ${summary.value.rounds} rounds` },
  { key: 'start', label: 'First payment due', value: formatLagosDate(summary.value.firstDueDate) },
  { key: 'end', label: 'Last payout (estimated)', value: formatLagosDate(summary.value.lastDueDate) },
  { key: 'positions', label: 'Payout order', value: POSITION_METHOD_LABELS[props.settings.positionMethod]?.title ?? '—' }
])

const explanation = computed(() => {
  const n = props.settings.plannedMemberCount
  const amount = formatKobo(props.settings.contributionAmount)
  return props.settings.recipientContributes
    ? `All ${n} members pay ${amount} every round, including the person collecting, so each payout is ${n} × ${amount} = ${formatKobo(summary.value.payoutPerRound)}.`
    : `The person collecting doesn't pay in their own round, so each payout is ${n - 1} × ${amount} = ${formatKobo(summary.value.payoutPerRound)}.`
})
</script>
