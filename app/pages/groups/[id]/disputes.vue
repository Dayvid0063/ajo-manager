<!-- app/pages/groups/[id]/disputes.vue -->
<!-- Raise a problem, and see disputes (owner/admins: all; members: their own). -->
<template>
  <div v-if="group" class="flex flex-col gap-5">
    <AppCard v-if="!showForm" class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-bold">Something wrong?</h2>
        <p class="text-sm text-text-muted">Raise it here so it's on record and the group admins can help.</p>
      </div>
      <AppButton icon="i-lucide-flag" @click="showForm = true">Raise a dispute</AppButton>
    </AppCard>

    <AppCard v-else as="form" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <div>
        <h2 class="font-bold">Raise a dispute</h2>
        <p class="text-sm text-text-muted">
          The group owner and admins will see it and reply. Ajo Manager keeps the record and the conversation — it can't recover money or enforce payment.
        </p>
      </div>
      <AppAlert v-if="obligationId" tone="info">This dispute will be linked to the payment you came from.</AppAlert>
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>
      <ChoiceCards v-model="values.category" label="What is it about?" :columns="2" :options="DISPUTE_CATEGORY_OPTIONS" :error="fieldError('category')" />
      <AppTextarea
        v-model="values.description"
        label="What happened?"
        :rows="4"
        placeholder="Include dates, amounts and references if you have them."
        :error="fieldError('description')"
      />
      <div class="flex gap-2">
        <AppButton variant="secondary" @click="showForm = false">Cancel</AppButton>
        <AppButton type="submit" :loading="pending" class="flex-1">Submit dispute</AppButton>
      </div>
    </AppCard>

    <AppCard class="p-0 sm:p-0">
      <p v-if="!items.length" class="px-4 py-10 text-center text-text-muted">
        {{ group.canManage ? 'No disputes in this group.' : 'You haven\'t raised any disputes.' }}
      </p>
      <ul v-else class="divide-y divide-border">
        <li v-for="item in items" :key="item.id">
          <NuxtLink :to="`/disputes/${item.id}`" class="flex items-center gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5">
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ item.categoryLabel }}</p>
              <p class="text-sm text-text-muted">
                {{ item.isMine ? 'You' : item.openerName }} · {{ formatLagosDate(item.createdAt, 'medium') }} · {{ item.messages }} message{{ item.messages === 1 ? '' : 's' }}
              </p>
            </div>
            <StatusChip v-bind="DISPUTE_STATUS_CHIPS[item.status]" />
          </NuxtLink>
        </li>
      </ul>
    </AppCard>
  </div>
</template>

<script setup>
import { openDisputeSchema } from '#shared/schemas/disputes'
import { DISPUTE_CATEGORY_OPTIONS, DISPUTE_STATUS_CHIPS } from '~/utils/labels'

const route = useRoute()
const { group } = useGroupDetail()
const { data, refresh } = await useFetch(() => `/api/groups/${route.params.id}/disputes`)
const items = computed(() => data.value?.items ?? [])

// Arriving from a payment page pre-links the dispute to that payment
const obligationId = typeof route.query.obligation === 'string' ? route.query.obligation : undefined
const showForm = ref(!!obligationId)

const { values, formError, pending, fieldError, submit } = useForm(openDisputeSchema, {
  category: obligationId ? 'payment_not_confirmed' : null,
  description: '',
  obligationId
})

async function onSubmit() {
  const result = await submit(body => $fetch(`/api/groups/${route.params.id}/disputes`, { method: 'POST', body }))
  if (result) {
    await refresh()
    await navigateTo(`/disputes/${result.id}`)
  }
}
</script>
