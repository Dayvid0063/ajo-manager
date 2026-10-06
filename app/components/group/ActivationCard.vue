<!-- app/components/group/ActivationCard.vue -->
<!-- Owner only: readiness checklist (computed by the server) and the Start button. -->
<template>
  <AppCard class="flex flex-col gap-4" :class="readiness?.ready && 'border-primary/40'">
    <div>
      <h2 class="font-bold">Ready to start?</h2>
      <p class="text-sm text-text-muted">The group can start when everything below is ticked.</p>
    </div>

    <ul v-if="readiness" class="flex flex-col gap-2.5">
      <li v-for="check in readiness.checks" :key="check.key" class="flex items-start gap-2.5">
        <Icon
          :name="check.ok ? 'i-lucide-circle-check' : check.key === 'startDate' ? 'i-lucide-triangle-alert' : 'i-lucide-circle-dashed'"
          class="mt-0.5 size-5 shrink-0"
          :class="check.ok ? 'text-status-confirmed' : check.key === 'startDate' ? 'text-status-due' : 'text-text-muted'"
          aria-hidden="true"
        />
        <div>
          <p :class="check.ok ? 'font-semibold' : 'text-text-muted'">
            {{ check.label }}<span class="sr-only">{{ check.ok ? ' (done)' : ' (not yet)' }}</span>
          </p>
          <p v-if="check.detail" class="text-sm text-text-muted">{{ check.detail }}</p>
        </div>
      </li>
    </ul>

    <template v-if="readiness?.ready">
      <!-- Starting with fewer members than planned: show exactly what changes -->
      <div v-if="!readiness.full" class="flex flex-col gap-3 rounded-xl border border-status-due/40 bg-status-due-soft p-4">
        <p class="font-bold text-status-due">
          <Icon name="i-lucide-triangle-alert" class="mr-1 inline size-5 align-text-bottom" aria-hidden="true" />
          Only {{ readiness.memberCount }} of {{ readiness.plannedMemberCount }} members have joined
        </p>
        <p class="text-sm">
          You can wait for more people, or start now with {{ readiness.memberCount }} members. If you start now:
        </p>
        <ul class="flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>There will be {{ readiness.memberCount }} rounds instead of {{ readiness.plannedMemberCount }}.</li>
          <li>
            Each payout will be <strong><MoneyText :kobo="readiness.payoutPerRound" /></strong>
            instead of <strong><MoneyText :kobo="group.summary?.payoutPerRound ?? 0" /></strong>.
          </li>
          <li v-if="readiness.renumbered.length">
            Payout positions close up the gaps:
            <span v-for="(move, i) in readiness.renumbered" :key="move.memberId">
              {{ move.name }} {{ move.from }} → {{ move.to }}{{ i < readiness.renumbered.length - 1 ? ', ' : '.' }}
            </span>
          </li>
          <li>Everyone will be told their final position and payout date.</li>
        </ul>
        <label class="flex cursor-pointer items-start gap-3 text-sm font-semibold">
          <input v-model="confirmFewer" type="checkbox" class="mt-0.5 size-5 shrink-0 accent-[var(--ajo-primary)]">
          <span>Start with {{ readiness.memberCount }} members</span>
        </label>
      </div>

      <AppInput
        v-if="readiness.needsNewStartDate"
        v-model="startDate"
        type="date"
        label="New first payment date"
        hint="The planned date has passed. All other dates move with it."
        :error="dateError"
      />
      <AppAlert tone="info">
        Starting creates the full payment schedule. After this, members, positions and rules can't be changed.
      </AppAlert>
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
      <AppButton icon="i-lucide-rocket" :disabled="!readiness.full && !confirmFewer" :loading="activating" block @click="activate">
        {{ readiness.full ? 'Start the group' : `Start with ${readiness.memberCount} members` }}
      </AppButton>
    </template>
  </AppCard>
</template>

<script setup>
import { activateGroupSchema } from '#shared/schemas/membership'

const props = defineProps({
  group: { type: Object, required: true }
})
const emit = defineEmits(['activated'])

const { data: readiness, refresh } = await useFetch(() => `/api/groups/${props.group.id}/readiness`)

const startDate = ref('')
const dateError = ref('')
const error = ref('')
const activating = ref(false)
const confirmFewer = ref(false)

async function activate() {
  error.value = ''
  dateError.value = ''
  const body = {
    ...(readiness.value?.needsNewStartDate ? { startDate: startDate.value } : {}),
    ...(readiness.value?.full ? {} : { confirmFewerMembers: confirmFewer.value })
  }
  const parsed = activateGroupSchema.safeParse(body)
  if (!parsed.success || (readiness.value?.needsNewStartDate && !startDate.value)) {
    dateError.value = parsed.success ? 'Choose the new first payment date' : parsed.error.issues[0]?.message
    return
  }
  if (!window.confirm(`Start "${props.group.name}" now? The payment schedule will be created and can't be changed.`)) return

  activating.value = true
  try {
    await $fetch(`/api/groups/${props.group.id}/activate`, { method: 'POST', body: parsed.data })
    emit('activated')
  } catch (err) {
    error.value = err?.data?.message || 'Could not start the group.'
    await refresh()
  } finally {
    activating.value = false
  }
}
</script>
