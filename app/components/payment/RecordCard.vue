<!-- app/components/payment/RecordCard.vue -->
<!-- One "Mark as paid" claim: details, proof, and confirm/reject for reviewers.
     A claim (submitted) has a dashed border — it is not proof until confirmed. -->
<template>
  <div
    class="flex flex-col gap-3 rounded-xl border p-3.5"
    :class="record.status === 'submitted' ? 'border-2 border-dashed border-status-submitted' : 'border-border'"
  >
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="font-semibold">
          <MoneyText :kobo="record.amount" /> · {{ METHOD_LABELS[record.method] ?? record.method }}
        </p>
        <p class="text-sm text-text-muted">
          {{ who ? `${who} says they paid` : 'Paid' }} on {{ formatLagosDate(record.paymentDate, 'medium') }}
          · reported {{ formatLagosDateTime(record.submittedAt) }}
        </p>
      </div>
      <StatusChip v-bind="chip" />
    </div>

    <dl v-if="record.reference || record.note" class="flex flex-col gap-1 text-sm">
      <div v-if="record.reference"><dt class="inline text-text-muted">Reference: </dt><dd class="tabular inline font-semibold">{{ record.reference }}</dd></div>
      <div v-if="record.note"><dt class="inline text-text-muted">Note: </dt><dd class="inline">{{ record.note }}</dd></div>
    </dl>

    <AppAlert v-if="record.status === 'rejected' && record.rejectionReason" tone="error">Not confirmed: {{ record.rejectionReason }}</AppAlert>

    <div class="flex flex-wrap gap-2">
      <AppButton v-if="record.hasEvidence" variant="secondary" icon="i-lucide-paperclip" :loading="opening" @click="openEvidence">View proof</AppButton>
    </div>
    <p v-if="evidenceError" class="text-sm text-status-rejected">{{ evidenceError }}</p>

    <!-- Review -->
    <template v-if="record.canReview">
      <div v-if="rejecting" class="flex flex-col gap-2 rounded-xl border border-status-rejected/30 p-3">
        <AppTextarea v-model="reason" label="What's wrong?" :rows="2" placeholder="e.g. I haven't received this transfer yet." :error="reasonError" />
        <div class="flex gap-2">
          <AppButton variant="secondary" @click="rejecting = false">Back</AppButton>
          <AppButton variant="danger" class="flex-1" :loading="busy" @click="review('reject')">Not received</AppButton>
        </div>
      </div>
      <div v-else class="flex flex-col gap-2">
        <p class="text-sm font-semibold">Check your bank before confirming. Has this money arrived?</p>
        <div class="flex flex-wrap gap-2">
          <AppButton icon="i-lucide-circle-check" :loading="busy" @click="review('confirm')">Yes, confirm</AppButton>
          <AppButton variant="secondary" icon="i-lucide-circle-x" @click="rejecting = true">Not received</AppButton>
        </div>
      </div>
      <AppAlert v-if="reviewError" tone="error">{{ reviewError }}</AppAlert>
    </template>
  </div>
</template>

<script setup>
import { rejectRecordSchema } from '#shared/schemas/payments'
import { METHOD_LABELS } from '~/utils/labels'

const props = defineProps({
  record: { type: Object, required: true },
  who: { type: String, default: '' }
})
const emit = defineEmits(['reviewed'])

const chip = computed(() => ({
  submitted: { status: 'submitted', label: 'Awaiting confirmation' },
  confirmed: { status: 'confirmed', label: 'Confirmed' },
  rejected: { status: 'rejected', label: 'Not confirmed' }
})[props.record.status] ?? { status: 'upcoming' })

const opening = ref(false)
const evidenceError = ref('')
async function openEvidence() {
  opening.value = true
  evidenceError.value = ''
  // Open the tab first (popup blockers), then point it at the short-lived link
  const tab = window.open('', '_blank')
  try {
    const { url } = await $fetch(`/api/records/${props.record.id}/evidence`)
    if (tab) tab.location.href = url
    else window.location.href = url
  } catch (error) {
    tab?.close()
    evidenceError.value = error?.data?.message || 'Could not open the attachment.'
  } finally {
    opening.value = false
  }
}

const rejecting = ref(false)
const reason = ref('')
const reasonError = ref('')
const reviewError = ref('')
const busy = ref(false)

async function review(action) {
  reviewError.value = ''
  reasonError.value = ''
  let body
  if (action === 'reject') {
    const parsed = rejectRecordSchema.safeParse({ reason: reason.value })
    if (!parsed.success) {
      reasonError.value = parsed.error.issues[0]?.message
      return
    }
    body = parsed.data
  }
  busy.value = true
  try {
    await $fetch(`/api/records/${props.record.id}/${action}`, { method: 'POST', body })
    rejecting.value = false
    emit('reviewed', action)
  } catch (error) {
    reviewError.value = error?.data?.message || 'Could not save your decision.'
  } finally {
    busy.value = false
  }
}
</script>
