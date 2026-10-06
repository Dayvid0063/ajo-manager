<!-- app/pages/groups/new.vue -->
<!-- Create-group wizard: details → contributions → payout → rules → review. -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <NuxtLink to="/groups" class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text">
        <Icon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> My groups
      </NuxtLink>
      <h1 class="text-2xl font-extrabold tracking-tight">Create a group</h1>
    </div>

    <!-- Progress -->
    <nav aria-label="Steps">
      <ol class="flex gap-1.5">
        <li v-for="(label, index) in STEP_LABELS" :key="label" class="flex-1">
          <span class="block h-1.5 rounded-full" :class="index <= step ? 'bg-primary' : 'bg-border'" />
          <span class="mt-1.5 hidden text-xs font-semibold sm:block" :class="index === step ? 'text-primary' : 'text-text-muted'">
            {{ label }}
          </span>
        </li>
      </ol>
      <p class="mt-2 text-sm font-semibold text-text-muted sm:hidden">Step {{ step + 1 }} of {{ STEP_LABELS.length }} · {{ STEP_LABELS[step] }}</p>
    </nav>

    <form class="flex flex-col gap-5" novalidate @submit.prevent="next">
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

      <!-- 1. Details -->
      <AppCard v-if="step === 0" class="flex flex-col gap-4">
        <h2 class="text-lg font-bold">About your group</h2>
        <AppInput v-model="form.name" label="Group name" placeholder="e.g. Unity Family Ajo" :error="fieldError('name')" />
        <AppTextarea
          v-model="form.description"
          label="Description"
          :rows="3"
          placeholder="Who is this group for?"
          optional
          :error="fieldError('description')"
        />
      </AppCard>

      <!-- 2. Contributions -->
      <AppCard v-else-if="step === 1" class="flex flex-col gap-4">
        <h2 class="text-lg font-bold">Contributions</h2>
        <AppInput
          v-model="form.amountNaira"
          label="How much does each member pay? (₦)"
          inputmode="decimal"
          placeholder="e.g. 20000"
          hint="Everyone pays the same amount."
          :error="fieldError('contributionAmount')"
        />
        <ChoiceCards
          v-model="form.frequency"
          label="How often?"
          :columns="2"
          :options="[
            { value: 'weekly', title: 'Weekly', description: 'Every 7 days' },
            { value: 'monthly', title: 'Monthly', description: 'Same date every month' }
          ]"
          :error="fieldError('frequency')"
        />
        <AppInput
          v-model="form.plannedMemberCount"
          label="How many members, including you?"
          inputmode="numeric"
          placeholder="e.g. 10"
          :hint="`Between ${GROUP_LIMITS.minMembers} and ${GROUP_LIMITS.maxMembers}. Each member collects once, so this is also the number of rounds.`"
          :error="fieldError('plannedMemberCount')"
        />
        <AppInput
          v-model="form.startDate"
          label="When is the first payment due?"
          type="date"
          :hint="`You can change this until the platform fee is confirmed.`"
          :error="fieldError('startDate')"
        />
        <ChoiceCards
          v-model="form.recipientContributes"
          label="Does the person collecting also pay in their own round?"
          :options="[
            { value: true, title: 'Yes, everyone pays every round', description: 'The payout includes the collector\'s own share.' },
            { value: false, title: 'No, the collector skips their round', description: 'The payout is one share smaller.' }
          ]"
          :error="fieldError('recipientContributes')"
        />
      </AppCard>

      <!-- 3. Payout -->
      <AppCard v-else-if="step === 2" class="flex flex-col gap-4">
        <h2 class="text-lg font-bold">Payout order</h2>
        <ChoiceCards
          v-model="form.positionMethod"
          label="How is the payout order decided?"
          :options="positionOptions"
          :error="fieldError('positionMethod')"
        />
        <ChoiceCards
          v-model="form.recipientCanConfirm"
          label="Who can confirm that a payment arrived?"
          :options="[
            { value: true, title: 'The person who received it, or an admin', description: 'Recommended — the collector knows best what arrived.' },
            { value: false, title: 'Only the owner and admins', description: 'Admins check and confirm every payment.' }
          ]"
        />
      </AppCard>

      <!-- 4. Rules -->
      <AppCard v-else-if="step === 3" class="flex flex-col gap-4">
        <div>
          <h2 class="text-lg font-bold">Group rules</h2>
          <p class="text-sm text-text-muted">We've written starter rules from your settings. Edit them to match how your group works. Every member must accept them before the group starts.</p>
        </div>
        <AppTextarea v-model="form.rules" label="Rules" :rows="14" :error="fieldError('rules')" />
        <AppButton variant="ghost" icon="i-lucide-rotate-ccw" class="self-start" @click="resetRules">Use the starter rules again</AppButton>
      </AppCard>

      <!-- 5. Review -->
      <template v-else>
        <AppCard class="flex flex-col gap-4">
          <div>
            <h2 class="text-lg font-bold">{{ form.name }}</h2>
            <p v-if="form.description" class="text-text-muted">{{ form.description }}</p>
          </div>
          <GroupSummary :settings="reviewSettings" />
        </AppCard>

        <AppCard class="flex items-start gap-3 border-status-fee/30 bg-status-fee-soft">
          <Icon name="i-lucide-receipt" class="mt-0.5 size-5 shrink-0 text-status-fee" aria-hidden="true" />
          <div>
            <p class="font-bold text-status-fee">Next: the platform fee</p>
            <p class="text-sm">
              After you create the group, you'll pay a one-time platform fee per cycle by bank transfer. This is separate from member contributions — Ajo Manager never holds your group's money.
            </p>
          </div>
        </AppCard>
      </template>

      <div class="flex gap-3">
        <AppButton v-if="step > 0" variant="secondary" icon="i-lucide-arrow-left" @click="back">Back</AppButton>
        <AppButton type="submit" class="flex-1" :loading="pending">
          {{ step === LAST_STEP ? 'Create group' : 'Continue' }}
        </AppButton>
      </div>
    </form>
  </div>
</template>

<script setup>
import {
  contributionSettingsSchema,
  createGroupSchema,
  GROUP_LIMITS,
  groupInfoSchema,
  payoutSettingsSchema,
  rulesSchema
} from '#shared/schemas/group'
import { POSITION_METHOD_LABELS } from '~/utils/labels'

useHead({ title: 'Create a group · Ajo Manager' })

const STEP_LABELS = ['Details', 'Contributions', 'Payout', 'Rules', 'Review']
const LAST_STEP = STEP_LABELS.length - 1
const STEP_SCHEMAS = [groupInfoSchema, contributionSettingsSchema, payoutSettingsSchema, rulesSchema]
const STEP_FIELDS = [
  ['name', 'description'],
  ['contributionAmount', 'frequency', 'startDate', 'plannedMemberCount', 'recipientContributes'],
  ['positionMethod', 'recipientCanConfirm'],
  ['rules']
]

const positionOptions = Object.entries(POSITION_METHOD_LABELS).map(([value, label]) => ({ value, ...label }))

const step = ref(0)
const errors = ref({})
const formError = ref('')
const pending = ref(false)

const form = reactive({
  name: '',
  description: '',
  amountNaira: '',
  frequency: 'monthly',
  plannedMemberCount: '',
  startDate: '',
  recipientContributes: null,
  positionMethod: null,
  recipientCanConfirm: true,
  rules: ''
})

function fieldError(name) {
  return errors.value[name]?.[0] ?? ''
}

function amountKobo() {
  try {
    return form.amountNaira === '' ? Number.NaN : nairaToKobo(form.amountNaira)
  } catch {
    return Number.NaN
  }
}

function payload() {
  return {
    name: form.name,
    description: form.description,
    contributionAmount: amountKobo(),
    frequency: form.frequency,
    plannedMemberCount: form.plannedMemberCount,
    startDate: form.startDate,
    recipientContributes: form.recipientContributes,
    positionMethod: form.positionMethod,
    recipientCanConfirm: form.recipientCanConfirm,
    rules: form.rules
  }
}

function validateStep(index) {
  const result = STEP_SCHEMAS[index].safeParse(payload())
  const stepErrors = result.success ? {} : toFieldErrors(result.error)
  if (index === 1 && Number.isNaN(amountKobo())) {
    stepErrors.contributionAmount = ['Enter an amount in naira, e.g. 20000']
  }
  errors.value = stepErrors
  return Object.keys(stepErrors).length === 0
}

// Starter rules follow the settings until the owner edits them
let lastGeneratedRules = ''
function starterRules() {
  return defaultRules({
    name: form.name,
    contributionAmount: Number.isNaN(amountKobo()) ? 0 : amountKobo(),
    frequency: form.frequency,
    plannedMemberCount: Number(form.plannedMemberCount) || 0,
    recipientContributes: form.recipientContributes === true
  })
}
function resetRules() {
  lastGeneratedRules = starterRules()
  form.rules = lastGeneratedRules
}

const reviewSettings = computed(() => ({
  contributionAmount: amountKobo(),
  frequency: form.frequency,
  startDate: form.startDate,
  plannedMemberCount: Number(form.plannedMemberCount),
  recipientContributes: form.recipientContributes === true,
  positionMethod: form.positionMethod
}))

function goTo(index) {
  step.value = index
  if (index === 3 && (!form.rules || form.rules === lastGeneratedRules)) {
    resetRules()
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function back() {
  errors.value = {}
  formError.value = ''
  goTo(step.value - 1)
}

async function next() {
  formError.value = ''
  if (step.value < LAST_STEP) {
    if (validateStep(step.value)) goTo(step.value + 1)
    return
  }
  await submit()
}

async function submit() {
  const result = createGroupSchema.safeParse(payload())
  if (!result.success) {
    jumpToFirstError(toFieldErrors(result.error))
    return
  }
  pending.value = true
  try {
    const { group } = await $fetch('/api/groups', { method: 'POST', body: result.data })
    await navigateTo(`/groups/${group.id}/fee`)
  } catch (error) {
    const fields = error?.data?.data?.fields
    if (fields) jumpToFirstError(fields)
    else formError.value = error?.data?.message || 'We could not create the group. Please try again.'
  } finally {
    pending.value = false
  }
}

function jumpToFirstError(fields) {
  errors.value = fields
  const index = STEP_FIELDS.findIndex(names => names.some(name => fields[name]))
  if (index !== -1) step.value = index
}
</script>
