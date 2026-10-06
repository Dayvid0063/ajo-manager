<!-- app/pages/groups/[id]/summary.vue -->
<!-- Cycle summary: progress while running, the final record when completed. -->
<template>
  <div v-if="summary && group" class="flex flex-col gap-5">
    <AppAlert v-if="summary.status === 'completed'" tone="success">
      This cycle was completed{{ summary.completedAt ? ` on ${formatLagosDate(summary.completedAt, 'medium')}` : '' }}.
      Records stay available for everyone in the group.
    </AppAlert>

    <div class="grid gap-3 sm:grid-cols-3">
      <AppCard>
        <p class="text-sm text-text-muted">Rounds completed</p>
        <p class="tabular text-2xl font-extrabold">{{ summary.rounds.completed }} / {{ summary.rounds.total }}</p>
      </AppCard>
      <AppCard>
        <p class="text-sm text-text-muted">Payments confirmed</p>
        <p class="tabular text-2xl font-extrabold">{{ summary.payments.confirmed }} / {{ summary.payments.total }}</p>
        <p class="text-sm text-text-muted"><MoneyText :kobo="summary.payments.confirmedAmount" /> of <MoneyText :kobo="summary.payments.expectedAmount" /></p>
      </AppCard>
      <AppCard>
        <p class="text-sm text-text-muted">Disputes</p>
        <p class="tabular text-2xl font-extrabold">{{ summary.disputes.open }} open</p>
        <p class="text-sm text-text-muted">{{ summary.disputes.resolved }} resolved · {{ summary.disputes.rejected }} closed</p>
      </AppCard>
    </div>

    <AppCard class="p-0 sm:p-0">
      <h2 class="px-4 pt-4 font-bold sm:px-5">Each member</h2>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[560px] text-left text-sm">
          <thead class="text-text-muted">
            <tr class="border-b border-border">
              <th scope="col" class="px-4 py-3 font-semibold sm:px-5">#</th>
              <th scope="col" class="px-2 py-3 font-semibold">Member</th>
              <th scope="col" class="px-2 py-3 text-right font-semibold">Paid in (confirmed)</th>
              <th scope="col" class="px-2 py-3 text-right font-semibold">Payout received</th>
              <th scope="col" class="px-4 py-3 text-right font-semibold sm:px-5">Unconfirmed</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="row in summary.members" :key="row.memberId" :class="row.isMe && 'bg-primary-soft/50'">
              <td class="tabular px-4 py-3 font-bold sm:px-5">{{ row.position ?? '–' }}</td>
              <td class="px-2 py-3">
                <p class="font-semibold">{{ row.name }}<span v-if="row.isMe" class="text-text-muted"> (you)</span></p>
                <p v-if="row.payoutDate" class="text-xs text-text-muted">Payout {{ formatLagosDate(row.payoutDate, 'medium') }}</p>
              </td>
              <td class="tabular px-2 py-3 text-right"><MoneyText :kobo="row.paidConfirmed" /> <span class="text-text-muted">/ <MoneyText :kobo="row.expectedToPay" /></span></td>
              <td class="tabular px-2 py-3 text-right"><MoneyText :kobo="row.receivedConfirmed" /> <span class="text-text-muted">/ <MoneyText :kobo="row.expectedPayout" /></span></td>
              <td class="tabular px-4 py-3 text-right sm:px-5" :class="row.outstanding ? 'font-bold text-status-overdue' : 'text-status-confirmed'">
                {{ row.outstanding || '✓' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>

    <!-- Owner: close the cycle after the final due date -->
    <AppCard v-if="group.isOwner && summary.canClose" class="flex flex-col gap-3 border-status-due/40">
      <h2 class="font-bold">Close the cycle</h2>
      <p class="text-sm text-text-muted">
        The last round was due {{ formatLagosDate(summary.lastDueDate) }}. If some payments will never be confirmed in the app
        (for example, settled offline), you can close the cycle. Unconfirmed payments stay on record exactly as they are.
      </p>
      <AppTextarea v-model="reason" label="Reason" :rows="2" :error="reasonError" />
      <AppAlert v-if="closeError" tone="error">{{ closeError }}</AppAlert>
      <AppButton variant="danger" icon="i-lucide-flag-triangle-right" class="self-start" :loading="closing" @click="close">Close cycle</AppButton>
    </AppCard>
  </div>
</template>

<script setup>
import { closeCycleSchema } from '#shared/schemas/disputes'

const route = useRoute()
const { group, refresh: refreshGroup } = useGroupDetail()
const { data: summary, refresh } = await useFetch(() => `/api/groups/${route.params.id}/summary`)

const reason = ref('')
const reasonError = ref('')
const closeError = ref('')
const closing = ref(false)

async function close() {
  reasonError.value = ''
  closeError.value = ''
  const parsed = closeCycleSchema.safeParse({ reason: reason.value })
  if (!parsed.success) {
    reasonError.value = parsed.error.issues[0]?.message
    return
  }
  if (!window.confirm('Close this cycle? This cannot be undone.')) return
  closing.value = true
  try {
    await $fetch(`/api/groups/${route.params.id}/close`, { method: 'POST', body: parsed.data })
    await Promise.all([refresh(), refreshGroup()])
  } catch (error) {
    closeError.value = error?.data?.message || 'Could not close the cycle.'
  } finally {
    closing.value = false
  }
}
</script>
