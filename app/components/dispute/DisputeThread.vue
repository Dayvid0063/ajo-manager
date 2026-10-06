<!-- app/components/dispute/DisputeThread.vue -->
<!-- A dispute: what was raised, the conversation, and the outcome.
     Used by members/owners (/disputes/:id) and platform admins (/admin/disputes/:id). -->
<template>
  <div class="flex flex-col gap-5">
    <AppCard class="flex flex-col gap-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-text-muted">{{ dispute.group.name }} · raised by {{ dispute.isMine ? 'you' : dispute.openerName }} · {{ formatLagosDateTime(dispute.createdAt) }}</p>
          <h1 class="text-xl font-extrabold">{{ dispute.categoryLabel }}</h1>
        </div>
        <StatusChip v-bind="DISPUTE_STATUS_CHIPS[dispute.status]" />
      </div>
      <p class="whitespace-pre-line">{{ dispute.description }}</p>
      <NuxtLink
        v-if="dispute.payment && linkPayments"
        :to="`/payments/${dispute.payment.obligationId}`"
        class="flex items-center gap-2 rounded-xl bg-surface-muted p-3 text-sm font-semibold hover:underline"
      >
        <Icon name="i-lucide-hand-coins" class="size-4" aria-hidden="true" />
        Round {{ dispute.payment.roundIndex }} payment by {{ dispute.payment.contributorName }} · <MoneyText :kobo="dispute.payment.amount" />
      </NuxtLink>
      <p v-else-if="dispute.payment" class="rounded-xl bg-surface-muted p-3 text-sm font-semibold">
        About: round {{ dispute.payment.roundIndex }} payment by {{ dispute.payment.contributorName }} · <MoneyText :kobo="dispute.payment.amount" /> ({{ dispute.payment.status }})
      </p>
    </AppCard>

    <!-- Outcome -->
    <AppAlert v-if="dispute.resolution" :tone="dispute.status === 'resolved' ? 'success' : 'info'">
      <p class="font-bold">{{ dispute.status === 'resolved' ? 'Resolved' : 'Closed' }} by {{ dispute.resolvedByName }} · {{ formatLagosDateTime(dispute.resolvedAt) }}</p>
      <p class="whitespace-pre-line">{{ dispute.resolution }}</p>
    </AppAlert>

    <!-- Conversation -->
    <AppCard class="flex flex-col gap-3">
      <h2 class="font-bold">Conversation</h2>
      <p v-if="!dispute.messages.length" class="text-text-muted">No messages yet.</p>
      <ol class="flex flex-col gap-3">
        <li
          v-for="message in dispute.messages"
          :key="message.id"
          class="max-w-[85%] rounded-2xl px-4 py-3"
          :class="message.isMine ? 'self-end bg-primary-soft' : message.authorRole === 'platform' ? 'bg-status-fee-soft' : 'bg-surface-muted'"
        >
          <p class="text-xs font-bold" :class="message.authorRole === 'platform' ? 'text-status-fee' : 'text-text-muted'">
            {{ message.isMine ? 'You' : message.authorName }}<template v-if="message.authorRole === 'manager' && !message.isMine"> · group admin</template>
            · {{ formatLagosDateTime(message.createdAt) }}
          </p>
          <p class="whitespace-pre-line">{{ message.body }}</p>
        </li>
      </ol>

      <form v-if="dispute.canReply" class="flex flex-col gap-2" novalidate @submit.prevent="send">
        <AppTextarea v-model="reply" label="Write a message" :rows="3" :error="replyError" />
        <AppButton type="submit" icon="i-lucide-send" :loading="busy === 'reply'" class="self-end">Send</AppButton>
      </form>
    </AppCard>

    <!-- Decide -->
    <AppCard v-if="dispute.canResolve" class="flex flex-col gap-3">
      <h2 class="font-bold">Record the outcome</h2>
      <p class="text-sm text-text-muted">Everyone involved will see this. Ajo Manager keeps records only — it can't recover money or enforce payment.</p>
      <ChoiceCards
        v-model="outcome"
        label="Outcome"
        :columns="2"
        :options="[
          { value: 'resolved', title: 'Resolved', description: 'The problem was sorted out.' },
          { value: 'rejected', title: 'Close without change', description: 'No action needed or not valid.' }
        ]"
      />
      <AppTextarea v-model="resolution" label="What was decided?" :rows="3" :error="resolutionError" />
      <AppButton icon="i-lucide-gavel" :loading="busy === 'resolve'" class="self-start" @click="decide">Save outcome</AppButton>
    </AppCard>

    <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
  </div>
</template>

<script setup>
import { disputeMessageSchema, resolveDisputeSchema } from '#shared/schemas/disputes'
import { DISPUTE_STATUS_CHIPS } from '~/utils/labels'

const props = defineProps({
  dispute: { type: Object, required: true },
  // Platform admins can't open a group's payment pages
  linkPayments: { type: Boolean, default: true }
})
const emit = defineEmits(['updated'])

const reply = ref('')
const replyError = ref('')
const outcome = ref('resolved')
const resolution = ref('')
const resolutionError = ref('')
const busy = ref('')
const error = ref('')

async function send() {
  replyError.value = ''
  const parsed = disputeMessageSchema.safeParse({ body: reply.value })
  if (!parsed.success) {
    replyError.value = parsed.error.issues[0]?.message
    return
  }
  busy.value = 'reply'
  error.value = ''
  try {
    await $fetch(`/api/disputes/${props.dispute.id}/messages`, { method: 'POST', body: parsed.data })
    reply.value = ''
    emit('updated')
  } catch (err) {
    error.value = err?.data?.message || 'Could not send your message.'
  } finally {
    busy.value = ''
  }
}

async function decide() {
  resolutionError.value = ''
  const parsed = resolveDisputeSchema.safeParse({ outcome: outcome.value, resolution: resolution.value })
  if (!parsed.success) {
    resolutionError.value = parsed.error.issues[0]?.message
    return
  }
  busy.value = 'resolve'
  error.value = ''
  try {
    await $fetch(`/api/disputes/${props.dispute.id}/resolve`, { method: 'POST', body: parsed.data })
    emit('updated')
  } catch (err) {
    error.value = err?.data?.message || 'Could not save the outcome.'
  } finally {
    busy.value = ''
  }
}
</script>
