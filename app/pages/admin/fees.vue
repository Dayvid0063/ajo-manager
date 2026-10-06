<!-- app/pages/admin/fees.vue -->
<!-- Platform admin: check each reported transfer against the platform bank
     account, then confirm or reject. Confirming opens the group to members. -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Fee verification</h1>
      <p class="text-text-muted">Check our bank account for each transfer before confirming. Match the amount, sender name and reference.</p>
    </div>

    <div role="tablist" class="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-muted p-1">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        role="tab"
        type="button"
        :aria-selected="statusFilter === tab.value"
        class="min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold"
        :class="statusFilter === tab.value ? 'bg-surface text-primary shadow-card' : 'text-text-muted hover:text-text'"
        @click="statusFilter = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <AppAlert v-if="actionMessage" :tone="actionMessage.tone">{{ actionMessage.text }}</AppAlert>

    <p v-if="!items.length" class="rounded-card border border-dashed border-border py-10 text-center text-text-muted">
      {{ status === 'pending' ? 'Loading…' : statusFilter === 'pending' ? 'Nothing to verify right now.' : 'No fees here.' }}
    </p>

    <AppCard v-for="item in items" :key="item.id" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-lg font-bold">{{ item.group.name }}</p>
          <p class="text-sm text-text-muted">Owner: {{ item.owner.name || '—' }} · {{ item.owner.email }}</p>
        </div>
        <StatusChip v-bind="FEE_CHIPS[item.status]" />
      </div>

      <SummaryList :items="rowsFor(item)" />

      <p v-if="item.note" class="rounded-xl bg-surface-muted p-3 text-sm"><strong>Owner's note:</strong> {{ item.note }}</p>
      <p v-if="item.previousAttempts" class="text-sm text-text-muted">Reported {{ item.previousAttempts + 1 }} times (earlier reports were rejected).</p>
      <AppButton v-if="item.hasEvidence" variant="secondary" icon="i-lucide-paperclip" class="self-start" @click="openEvidence(item)">View transfer screenshot</AppButton>
      <AppAlert v-if="item.status === 'rejected'" tone="error">Rejected: {{ item.rejectionReason }}</AppAlert>

      <template v-if="item.status === 'pending'">
        <div v-if="rejectingId === item.id" class="flex flex-col gap-3 rounded-xl border border-status-rejected/30 p-3">
          <AppTextarea v-model="rejectReason" label="Why can't you confirm it?" :rows="2" placeholder="e.g. No transfer found with this reference and sender name." :error="rejectError" />
          <div class="flex gap-2">
            <AppButton variant="secondary" @click="rejectingId = ''">Back</AppButton>
            <AppButton variant="danger" :loading="busyId === item.id" class="flex-1" @click="reject(item)">Reject payment</AppButton>
          </div>
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <AppButton icon="i-lucide-circle-check" :loading="busyId === item.id" @click="confirmFee(item)">Confirm — money received</AppButton>
          <AppButton variant="secondary" icon="i-lucide-circle-x" @click="startReject(item)">Can't find it</AppButton>
        </div>
      </template>
    </AppCard>
  </div>
</template>

<script setup>
import { rejectFeeSchema } from '#shared/schemas/group'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Fee verification · Platform admin' })

const TABS = [
  { value: 'pending', label: 'To verify' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' }
]
const FEE_CHIPS = {
  pending: { status: 'submitted', label: 'Awaiting verification' },
  confirmed: { status: 'fee', label: 'Confirmed' },
  rejected: { status: 'rejected', label: 'Rejected' }
}

const statusFilter = ref('pending')
const { data, status, refresh } = await useFetch('/api/admin/fees', { query: { status: statusFilter } })
const items = computed(() => data.value?.items ?? [])

function rowsFor(item) {
  return [
    { key: 'amount', label: 'Amount expected', value: formatKobo(item.amount) },
    { key: 'ref', label: 'Payment reference', value: item.paymentReference },
    { key: 'sender', label: 'Sender name', value: item.senderName },
    { key: 'date', label: 'Transfer date', value: item.transferDate ? formatLagosDate(item.transferDate, 'medium') : '—' },
    ...(item.transferReference ? [{ key: 'bankref', label: 'Bank reference', value: item.transferReference }] : []),
    { key: 'reported', label: 'Reported', value: item.reportedAt ? formatLagosDateTime(item.reportedAt) : '—' }
  ]
}

async function openEvidence(item) {
  const tab = window.open('', '_blank')
  try {
    const { url } = await $fetch(`/api/admin/fees/${item.id}/evidence`)
    if (tab) tab.location.href = url
  } catch (error) {
    tab?.close()
    actionMessage.value = { tone: 'error', text: error?.data?.message || 'Could not open the screenshot.' }
  }
}

const busyId = ref('')
const rejectingId = ref('')
const rejectReason = ref('')
const rejectError = ref('')
const actionMessage = ref(null)

async function confirmFee(item) {
  if (!window.confirm(`Confirm that ${formatKobo(item.amount)} from "${item.senderName}" (ref ${item.paymentReference}) is in our bank account?`)) return
  busyId.value = item.id
  actionMessage.value = null
  try {
    const result = await $fetch(`/api/admin/fees/${item.id}/confirm`, { method: 'POST' })
    actionMessage.value = result.changed
      ? { tone: 'success', text: `Confirmed. "${item.group.name}" can now invite members.` }
      : { tone: 'info', text: 'This fee was already confirmed — nothing changed.' }
    await refresh()
  } catch (error) {
    actionMessage.value = { tone: 'error', text: error?.data?.message || 'Could not confirm this fee.' }
  } finally {
    busyId.value = ''
  }
}

function startReject(item) {
  rejectingId.value = item.id
  rejectReason.value = ''
  rejectError.value = ''
}

async function reject(item) {
  const parsed = rejectFeeSchema.safeParse({ reason: rejectReason.value })
  if (!parsed.success) {
    rejectError.value = parsed.error.issues[0]?.message ?? 'Enter a reason'
    return
  }
  busyId.value = item.id
  actionMessage.value = null
  try {
    await $fetch(`/api/admin/fees/${item.id}/reject`, { method: 'POST', body: parsed.data })
    actionMessage.value = { tone: 'success', text: `Rejected. The owner of "${item.group.name}" has been told why.` }
    rejectingId.value = ''
    await refresh()
  } catch (error) {
    actionMessage.value = { tone: 'error', text: error?.data?.message || 'Could not reject this fee.' }
  } finally {
    busyId.value = ''
  }
}
</script>
