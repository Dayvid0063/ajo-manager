<!-- app/pages/payments/[id].vue -->
<!-- One payment: how much, who to pay (+ their account), Mark as paid, and its history. -->
<template>
  <div class="flex flex-col gap-5">
    <NuxtLink to="/payments" class="inline-flex items-center gap-1 self-start text-sm font-semibold text-text-muted hover:text-text">
      <Icon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> Payments
    </NuxtLink>

    <AppAlert v-if="error" tone="error">{{ error.statusCode === 404 ? 'We could not find this payment.' : 'Could not load this payment.' }}</AppAlert>

    <template v-else-if="data">
      <AppAlert v-if="justSubmitted" tone="info">
        Thanks — {{ data.recipient.name }} has been asked to confirm your payment. It shows as
        <strong>awaiting confirmation</strong> until they do.
      </AppAlert>

      <!-- Summary -->
      <AppCard class="flex flex-col gap-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-text-muted">
              <NuxtLink :to="`/groups/${o.groupId}`" class="hover:underline">{{ o.groupName }}</NuxtLink> · Round {{ o.roundIndex }} of {{ o.totalRounds }}
            </p>
            <p class="text-3xl font-extrabold"><MoneyText :kobo="o.amount" /></p>
            <p class="text-text-muted">
              {{ o.isMine ? 'You pay' : `${o.contributorName} pays` }} {{ data.recipient.name }} · {{ formatLagosDate(o.dueDate) }}
            </p>
          </div>
          <StatusChip :status="o.displayStatus" />
        </div>
        <p v-if="!['confirmed', 'submitted'].includes(o.status)" class="text-sm font-semibold" :class="o.displayStatus === 'overdue' ? 'text-status-overdue' : 'text-text-muted'">
          {{ o.dueText }}
        </p>
      </AppCard>

      <!-- Who you are paying -->
      <AppCard v-if="o.isMine && o.status !== 'confirmed'" class="flex flex-col gap-3">
        <h2 class="font-bold">Who you are paying</h2>
        <p class="text-lg font-semibold">{{ data.recipient.name }}</p>
        <dl v-if="data.recipient.bank" class="flex flex-col gap-2">
          <div v-for="row in bankRows" :key="row.label" class="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
            <div class="min-w-0">
              <dt class="text-sm text-text-muted">{{ row.label }}</dt>
              <dd class="tabular truncate text-lg font-bold">{{ row.value }}</dd>
            </div>
            <AppButton v-if="row.copy" variant="ghost" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy(row.value)">
              {{ copied ? 'Copied' : 'Copy' }}
            </AppButton>
          </div>
        </dl>
        <AppAlert v-else tone="warning">
          {{ data.recipient.name }} hasn't added their payout account yet. Ask them for it, or pay the way your group agreed.
        </AppAlert>
        <p class="text-sm text-text-muted">
          Pay from your own bank app or in cash. Ajo Manager never handles the money — it only keeps the record.
        </p>
      </AppCard>

      <!-- Mark as paid -->
      <AppCard v-if="data.canSubmit" as="form" class="flex flex-col gap-4 border-primary/30" novalidate @submit.prevent="onSubmit">
        <div>
          <h2 class="font-bold">I've paid — tell {{ data.recipient.name }}</h2>
          <p class="text-sm text-text-muted">
            This lets {{ data.recipient.name }} know you've paid. It counts only after they (or a group admin) confirm the money arrived.
          </p>
        </div>
        <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

        <div class="flex items-center justify-between rounded-xl bg-surface-muted px-3.5 py-3">
          <span class="text-sm text-text-muted">Amount</span>
          <span class="text-lg font-bold"><MoneyText :kobo="o.amount" /></span>
        </div>
        <p v-if="fieldError('amount')" class="text-sm font-medium text-status-rejected">{{ fieldError('amount') }}</p>

        <AppInput v-model="values.paymentDate" type="date" label="When did you pay?" :error="fieldError('paymentDate')" />
        <ChoiceCards
          v-model="values.method"
          label="How did you pay?"
          :columns="2"
          :options="[
            { value: 'bank_transfer', title: 'Bank transfer' },
            { value: 'cash', title: 'Cash' },
            { value: 'other', title: 'Other' }
          ]"
          :error="fieldError('method')"
        />
        <AppInput
          v-model="values.reference"
          label="Transaction reference"
          optional
          hint="From your bank receipt. Helps the recipient find your payment."
          :error="fieldError('reference')"
        />
        <EvidenceUpload v-model="values.evidenceKey" purpose="contribution" :target-id="o.id" @uploading="uploading = $event" />
        <AppTextarea v-model="values.note" label="Note" :rows="2" optional :error="fieldError('note')" />

        <AppButton type="submit" icon="i-lucide-send" :loading="pending" :disabled="uploading" block>Mark as paid</AppButton>
      </AppCard>

      <!-- History -->
      <AppCard v-if="data.records.length" class="flex flex-col gap-3">
        <h2 class="font-bold">History</h2>
        <RecordCard
          v-for="record in data.records"
          :key="record.id"
          :record="record"
          :who="o.isMine ? '' : o.contributorName"
          @reviewed="refresh"
        />
      </AppCard>
    </template>
  </div>
</template>

<script setup>
import { markPaidSchema } from '#shared/schemas/payments'

useHead({ title: 'Payment · Ajo Manager' })

const route = useRoute()
const { data, error, refresh } = await useFetch(() => `/api/obligations/${route.params.id}`)
const o = computed(() => data.value?.obligation ?? {})

const bankRows = computed(() => {
  const bank = data.value?.recipient.bank
  if (!bank) return []
  return [
    { label: 'Bank', value: bank.bankName },
    { label: 'Account number', value: bank.accountNumber, copy: true },
    { label: 'Account name', value: bank.accountName }
  ]
})

const { values, formError, pending, fieldError, submit } = useForm(markPaidSchema, {
  amount: 0,
  paymentDate: lagosToday(),
  method: 'bank_transfer',
  reference: '',
  note: '',
  evidenceKey: undefined
})
watch(() => o.value.amount, (amount) => { values.amount = amount ?? 0 }, { immediate: true })

const uploading = ref(false)
const justSubmitted = ref(false)

async function onSubmit() {
  if (!values.evidenceKey) values.evidenceKey = undefined
  const result = await submit(body => $fetch(`/api/obligations/${route.params.id}/mark-paid`, { method: 'POST', body }))
  if (result) {
    justSubmitted.value = true
    await refresh()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const copied = ref(false)
async function copy(value) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}
</script>
