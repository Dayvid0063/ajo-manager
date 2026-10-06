<!-- app/pages/groups/[id]/fee.vue -->
<!-- Platform fee: pay by bank transfer OUTSIDE the app, then report it.
     A platform admin checks the bank and confirms. No money moves through the app. -->
<template>
  <div v-if="fee" class="flex flex-col gap-5">
    <AppAlert v-if="fee.feeStatus === 'confirmed'" tone="success">
      Your platform fee was confirmed{{ fee.fee?.verifiedAt ? ` on ${formatLagosDate(fee.fee.verifiedAt, 'medium')}` : '' }}. You can now invite members.
    </AppAlert>

    <AppAlert v-else-if="fee.feeStatus === 'rejected'" tone="error">
      <p class="font-bold">We could not confirm your transfer.</p>
      <p>Reason: {{ fee.fee?.rejectionReason }}</p>
      <p class="mt-1">Please check the details below and report your payment again.</p>
    </AppAlert>

    <!-- Reported, awaiting verification: a claim, not yet proof (dashed) -->
    <AppCard v-if="fee.feeStatus === 'pending'" class="flex flex-col gap-3 border-2 border-dashed border-status-submitted">
      <div class="flex items-start justify-between gap-3">
        <h2 class="font-bold">Payment reported</h2>
        <StatusChip status="submitted" label="Awaiting verification" />
      </div>
      <p class="text-text-muted">
        Thanks! We're checking our bank for your transfer — this usually takes less than a day. You'll get a notification when it's confirmed.
      </p>
      <SummaryList :items="reportRows" />
      <AppButton v-if="fee.fee?.hasEvidence" variant="secondary" icon="i-lucide-paperclip" class="self-start" @click="openEvidence">View your screenshot</AppButton>
    </AppCard>

    <!-- How to pay -->
    <AppCard v-if="canReport" class="flex flex-col gap-4 border-status-fee/30">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="font-bold">1. Pay the platform fee</h2>
          <p class="text-sm text-text-muted">Transfer from your bank app. This fee is for running your group on Ajo Manager — it is separate from member contributions.</p>
        </div>
        <StatusChip status="fee" />
      </div>

      <div class="rounded-xl bg-status-fee-soft p-4 text-center">
        <p class="text-sm font-semibold text-status-fee">Amount</p>
        <p class="text-3xl font-extrabold"><MoneyText :kobo="fee.amount" /></p>
      </div>

      <AppAlert v-if="!fee.bankConfigured" tone="warning">
        Our bank details are not available right now. Please contact support before paying.
      </AppAlert>
      <dl v-else class="flex flex-col gap-2">
        <div v-for="row in bankRows" :key="row.label" class="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
          <div class="min-w-0">
            <dt class="text-sm text-text-muted">{{ row.label }}</dt>
            <dd class="tabular truncate text-lg font-bold">{{ row.value }}</dd>
          </div>
          <AppButton v-if="row.copy" variant="ghost" :icon="copied === row.label ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy(row)">
            {{ copied === row.label ? 'Copied' : 'Copy' }}
          </AppButton>
        </div>
      </dl>

      <p class="flex items-start gap-2 text-sm">
        <Icon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-status-fee" aria-hidden="true" />
        <span>Put <strong>{{ fee.paymentReference }}</strong> in the transfer description (narration) so we can match your payment.</span>
      </p>
    </AppCard>

    <!-- Report it -->
    <AppCard v-if="canReport" as="form" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <div>
        <h2 class="font-bold">2. Tell us you've paid</h2>
        <p class="text-sm text-text-muted">This helps us find your transfer. Your group can start inviting members once we confirm it.</p>
      </div>
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>
      <AppInput
        v-model="values.senderName"
        label="Name on the account you paid from"
        autocomplete="name"
        :error="fieldError('senderName')"
      />
      <AppInput v-model="values.transferDate" label="Date of transfer" type="date" :error="fieldError('transferDate')" />
      <AppInput
        v-model="values.transferReference"
        label="Transaction reference from your bank"
        optional
        :error="fieldError('transferReference')"
      />
      <EvidenceUpload v-model="values.evidenceKey" purpose="fee" :target-id="group.id" label="Screenshot of the transfer" @uploading="uploading = $event" />
      <AppTextarea v-model="values.note" label="Anything else we should know?" :rows="2" optional :error="fieldError('note')" />
      <AppButton type="submit" :loading="pending" :disabled="uploading" icon="i-lucide-send" block>I have paid — report payment</AppButton>
    </AppCard>

    <AppCard v-if="!group?.isOwner && fee.feeStatus !== 'confirmed'" class="text-text-muted">
      Only the group owner can pay and report the platform fee.
    </AppCard>
  </div>
</template>

<script setup>
import { reportFeeSchema } from '#shared/schemas/group'

const route = useRoute()
const { group, refresh: refreshGroup } = useGroupDetail()

const { data: fee, refresh } = await useFetch(() => `/api/groups/${route.params.id}/fee`)

const canReport = computed(
  () => group.value?.isOwner && fee.value?.groupStatus === 'draft' && ['unpaid', 'rejected'].includes(fee.value?.feeStatus)
)

const bankRows = computed(() => [
  { label: 'Bank', value: fee.value?.bank.name },
  { label: 'Account number', value: fee.value?.bank.accountNumber, copy: true },
  { label: 'Account name', value: fee.value?.bank.accountName },
  { label: 'Payment reference', value: fee.value?.paymentReference, copy: true }
])

const reportRows = computed(() => {
  const report = fee.value?.fee
  if (!report) return []
  return [
    { key: 'amount', label: 'Amount', value: formatKobo(report.amount) },
    { key: 'sender', label: 'Paid from', value: report.senderName },
    { key: 'date', label: 'Transfer date', value: formatLagosDate(report.transferDate, 'medium') },
    ...(report.transferReference ? [{ key: 'ref', label: 'Bank reference', value: report.transferReference }] : []),
    { key: 'reported', label: 'Reported', value: formatLagosDateTime(report.reportedAt) }
  ]
})

const { values, formError, pending, fieldError, submit } = useForm(reportFeeSchema, {
  senderName: '',
  transferDate: lagosToday(),
  transferReference: '',
  note: '',
  evidenceKey: undefined
})
const uploading = ref(false)

async function openEvidence() {
  const tab = window.open('', '_blank')
  try {
    const { url } = await $fetch(`/api/groups/${route.params.id}/fee/evidence`)
    if (tab) tab.location.href = url
  } catch {
    tab?.close()
  }
}

async function onSubmit() {
  if (!values.evidenceKey) values.evidenceKey = undefined
  const result = await submit(data => $fetch(`/api/groups/${route.params.id}/fee`, { method: 'POST', body: data }))
  if (result) {
    await Promise.all([refresh(), refreshGroup()])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const copied = ref('')
async function copy(row) {
  try {
    await navigator.clipboard.writeText(row.value)
    copied.value = row.label
    setTimeout(() => (copied.value = ''), 2000)
  } catch {
    copied.value = ''
  }
}
</script>
