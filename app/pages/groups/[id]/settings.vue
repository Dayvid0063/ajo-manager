<!-- app/pages/groups/[id]/settings.vue -->
<!-- Owner only. Details are editable until the group starts; contribution and
     payout settings only while it's a draft (before the fee is confirmed). -->
<template>
  <div v-if="group" class="flex flex-col gap-5">
    <AppAlert v-if="!group.isOwner" tone="info">Only the group owner can change settings.</AppAlert>

    <template v-else>
      <AppAlert v-if="saved" tone="success">Settings saved.</AppAlert>
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

      <AppCard as="form" class="flex flex-col gap-4" novalidate @submit.prevent="save(['name', 'description'])">
        <h2 class="font-bold">Group details</h2>
        <AppInput v-model="form.name" label="Group name" :disabled="!editable" :error="fieldError('name')" />
        <AppTextarea v-model="form.description" label="Description" :rows="3" optional :disabled="!editable" :error="fieldError('description')" />
        <AppButton v-if="editable" type="submit" :loading="pending === 'details'" class="self-start">Save details</AppButton>
      </AppCard>

      <AppCard as="form" class="flex flex-col gap-4" novalidate @submit.prevent="save(SETTINGS_FIELDS)">
        <div>
          <h2 class="font-bold">Contributions and payout</h2>
          <p v-if="!isDraft" class="text-sm text-text-muted">Locked: these can't change once the platform fee is confirmed, because members join based on them.</p>
          <p v-else class="text-sm text-text-muted">If you change these, check that your rules still match.</p>
        </div>
        <AppInput
          v-model="form.amountNaira"
          label="Contribution per member (₦)"
          inputmode="decimal"
          :disabled="!isDraft"
          :error="fieldError('contributionAmount')"
        />
        <ChoiceCards
          v-model="form.frequency"
          label="How often?"
          :columns="2"
          :disabled="!isDraft"
          :options="[
            { value: 'weekly', title: 'Weekly' },
            { value: 'monthly', title: 'Monthly' }
          ]"
          :error="fieldError('frequency')"
        />
        <AppInput
          v-model="form.plannedMemberCount"
          label="Number of members, including you"
          inputmode="numeric"
          :disabled="!isDraft"
          :error="fieldError('plannedMemberCount')"
        />
        <AppInput v-model="form.startDate" label="First payment due" type="date" :disabled="!isDraft" :error="fieldError('startDate')" />
        <ChoiceCards
          v-model="form.recipientContributes"
          label="Does the person collecting also pay in their own round?"
          :disabled="!isDraft"
          :options="[
            { value: true, title: 'Yes, everyone pays every round' },
            { value: false, title: 'No, the collector skips their round' }
          ]"
          :error="fieldError('recipientContributes')"
        />
        <ChoiceCards
          v-model="form.positionMethod"
          label="How is the payout order decided?"
          :disabled="!isDraft"
          :options="positionOptions"
          :error="fieldError('positionMethod')"
        />
        <ChoiceCards
          v-model="form.recipientCanConfirm"
          label="Who can confirm that a payment arrived?"
          :disabled="!isDraft"
          :options="[
            { value: true, title: 'The person who received it, or an admin' },
            { value: false, title: 'Only the owner and admins' }
          ]"
        />
        <AppButton v-if="isDraft" type="submit" :loading="pending === 'settings'" class="self-start">Save settings</AppButton>
      </AppCard>

      <AppCard v-if="editable" class="flex flex-col gap-3 border-status-rejected/30">
        <h2 class="font-bold text-status-rejected">Cancel this group</h2>
        <p class="text-sm text-text-muted">
          Cancelling stops all setup and can't be undone. The platform fee is not refundable through the app.
        </p>
        <AppTextarea v-model="cancelReason" label="Reason" :rows="2" optional />
        <AppButton variant="danger" icon="i-lucide-ban" class="self-start" :loading="pending === 'cancel'" @click="cancelGroup">
          Cancel group
        </AppButton>
      </AppCard>
    </template>
  </div>
</template>

<script setup>
import { updateGroupSchema } from '#shared/schemas/group'
import { POSITION_METHOD_LABELS } from '~/utils/labels'

const SETTINGS_FIELDS = ['contributionAmount', 'frequency', 'plannedMemberCount', 'startDate', 'recipientContributes', 'positionMethod', 'recipientCanConfirm']

const route = useRoute()
const { group, refresh } = useGroupDetail()

const isDraft = computed(() => group.value?.status === 'draft')
const editable = computed(() => ['draft', 'awaiting_members'].includes(group.value?.status))
const positionOptions = Object.entries(POSITION_METHOD_LABELS).map(([value, label]) => ({ value, title: label.title }))

const form = reactive({})
function fillForm(g) {
  if (!g) return
  Object.assign(form, {
    name: g.name,
    description: g.description,
    amountNaira: String(g.contributionAmount / 100),
    frequency: g.frequency,
    plannedMemberCount: String(g.plannedMemberCount),
    startDate: g.startDate,
    recipientContributes: g.recipientContributes,
    positionMethod: g.positionMethod,
    recipientCanConfirm: g.recipientCanConfirm
  })
}
watch(group, fillForm, { immediate: true })

const errors = ref({})
const formError = ref('')
const pending = ref('')
const saved = ref(false)
const cancelReason = ref('')

function fieldError(name) {
  return errors.value[name]?.[0] ?? ''
}

function buildPatch(fields) {
  const all = {
    name: form.name,
    description: form.description,
    contributionAmount: (() => {
      try {
        return nairaToKobo(form.amountNaira)
      } catch {
        return Number.NaN
      }
    })(),
    frequency: form.frequency,
    plannedMemberCount: form.plannedMemberCount,
    startDate: form.startDate,
    recipientContributes: form.recipientContributes,
    positionMethod: form.positionMethod,
    recipientCanConfirm: form.recipientCanConfirm
  }
  return Object.fromEntries(fields.map(field => [field, all[field]]))
}

async function save(fields) {
  saved.value = false
  formError.value = ''
  const patch = buildPatch(fields)
  const result = updateGroupSchema.safeParse(patch)
  if (!result.success) {
    errors.value = toFieldErrors(result.error)
    if (Number.isNaN(patch.contributionAmount)) errors.value.contributionAmount = ['Enter an amount in naira, e.g. 20000']
    return
  }
  errors.value = {}
  pending.value = fields.includes('name') ? 'details' : 'settings'
  try {
    await $fetch(`/api/groups/${route.params.id}`, { method: 'PATCH', body: result.data })
    await refresh()
    saved.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    const fieldErrors = error?.data?.data?.fields
    if (fieldErrors) errors.value = fieldErrors
    else formError.value = error?.data?.message || 'Could not save. Please try again.'
  } finally {
    pending.value = ''
  }
}

async function cancelGroup() {
  if (!window.confirm('Cancel this group? This cannot be undone.')) return
  pending.value = 'cancel'
  formError.value = ''
  try {
    await $fetch(`/api/groups/${route.params.id}/cancel`, { method: 'POST', body: { reason: cancelReason.value } })
    await refresh()
    await navigateTo(`/groups/${route.params.id}`)
  } catch (error) {
    formError.value = error?.data?.message || 'Could not cancel the group.'
  } finally {
    pending.value = ''
  }
}
</script>
