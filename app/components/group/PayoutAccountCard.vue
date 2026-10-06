<!-- app/components/group/PayoutAccountCard.vue -->
<!-- The member's own payout account for this group. Shown to the people who
     pay them and to group admins — never in notifications. -->
<template>
  <AppCard class="flex flex-col gap-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="font-bold">Your payout account</h2>
        <p class="text-sm text-text-muted">Where members send your payout. Only the people paying you and group admins can see it.</p>
      </div>
      <Icon
        :name="account ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
        class="size-6 shrink-0"
        :class="account ? 'text-status-confirmed' : 'text-status-due'"
        aria-hidden="true"
      />
    </div>

    <template v-if="!editing && account">
      <SummaryList
        :items="[
          { key: 'bank', label: 'Bank', value: account.bankName },
          { key: 'number', label: 'Account number', value: account.accountNumber },
          { key: 'name', label: 'Account name', value: account.accountName }
        ]"
      />
      <AppButton variant="secondary" icon="i-lucide-pencil" class="self-start" @click="startEdit">Change</AppButton>
    </template>

    <form v-else class="flex flex-col gap-3" novalidate @submit.prevent="onSubmit">
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>
      <AppInput v-model="values.bankName" label="Bank" placeholder="e.g. GTBank" :error="fieldError('bankName')" />
      <AppInput v-model="values.accountNumber" label="Account number" inputmode="numeric" placeholder="10 digits" :error="fieldError('accountNumber')" />
      <AppInput v-model="values.accountName" label="Account name" autocomplete="name" :error="fieldError('accountName')" />
      <p class="text-sm text-text-muted">Never share your PIN, password or card details — Ajo Manager will never ask for them.</p>
      <div class="flex gap-2">
        <AppButton v-if="account" variant="secondary" @click="editing = false">Cancel</AppButton>
        <AppButton type="submit" :loading="pending" class="flex-1">Save payout account</AppButton>
      </div>
    </form>
  </AppCard>
</template>

<script setup>
import { bankAccountSchema } from '#shared/schemas/payments'

const props = defineProps({
  groupId: { type: String, required: true }
})

const { data, refresh } = await useFetch(() => `/api/groups/${props.groupId}/payout-account`)
const account = computed(() => data.value?.account ?? null)
const editing = ref(false)

const { values, formError, pending, fieldError, submit } = useForm(bankAccountSchema, { bankName: '', accountNumber: '', accountName: '' })

function startEdit() {
  Object.assign(values, account.value ?? {})
  editing.value = true
}

async function onSubmit() {
  const result = await submit(body => $fetch(`/api/groups/${props.groupId}/payout-account`, { method: 'PUT', body }))
  if (result) {
    await refresh()
    editing.value = false
  }
}
</script>
