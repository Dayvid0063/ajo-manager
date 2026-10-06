<!-- app/components/group/MyTodos.vue -->
<!-- What the current member still needs to do before the group starts. -->
<template>
  <AppCard class="flex flex-col gap-4">
    <h2 class="font-bold">Your part</h2>

    <!-- Rules -->
    <div class="flex items-start gap-3">
      <Icon
        :name="me.rulesAccepted ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
        class="mt-0.5 size-6 shrink-0"
        :class="me.rulesAccepted ? 'text-status-confirmed' : 'text-status-due'"
        aria-hidden="true"
      />
      <div class="flex flex-1 flex-col gap-2">
        <p class="font-semibold">{{ me.rulesAccepted ? 'You accepted the group rules' : 'Read and accept the group rules' }}</p>
        <AppButton v-if="!me.rulesAccepted" :to="`/groups/${group.id}/rules`" variant="secondary" class="self-start">Read rules</AppButton>
      </div>
    </div>

    <!-- Position -->
    <div class="flex items-start gap-3">
      <Icon
        :name="me.positionAccepted ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
        class="mt-0.5 size-6 shrink-0"
        :class="me.positionAccepted ? 'text-status-confirmed' : me.position ? 'text-status-due' : 'text-text-muted'"
        aria-hidden="true"
      />
      <div class="flex flex-1 flex-col gap-2">
        <template v-if="me.position">
          <p class="font-semibold">
            You are number {{ me.position }} of {{ group.plannedMemberCount }}
            <span v-if="payoutDate" class="font-normal text-text-muted">· payout around {{ formatLagosDate(payoutDate) }}</span>
          </p>
          <template v-if="!me.positionAccepted">
            <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
            <AppButton class="self-start" icon="i-lucide-check" :loading="accepting" @click="acceptPosition">Accept my position</AppButton>
          </template>
          <p v-else class="text-sm text-text-muted">Accepted. Your position is locked once the group starts.</p>
        </template>
        <template v-else>
          <p class="font-semibold">Your payout position</p>
          <p class="text-sm text-text-muted">{{ waitingText }}</p>
          <AppButton v-if="group.positionMethod === 'members_pick'" :to="`/groups/${group.id}/members`" variant="secondary" class="self-start">
            Choose my position
          </AppButton>
        </template>
      </div>
    </div>
  </AppCard>
</template>

<script setup>
const props = defineProps({
  group: { type: Object, required: true },
  me: { type: Object, required: true }
})
const emit = defineEmits(['changed'])

// Estimated: final dates are fixed when the group starts
const payoutDate = computed(() =>
  props.me.position && props.group.startDate
    ? addPeriods(props.group.startDate, props.group.frequency, props.me.position - 1)
    : ''
)

const waitingText = computed(() => ({
  admin_assigns: 'The owner or an admin will give you a position.',
  members_pick: 'Pick any open position — first come, first served.',
  random: 'Positions are drawn at random once everyone has joined.'
})[props.group.positionMethod])

const accepting = ref(false)
const error = ref('')

async function acceptPosition() {
  accepting.value = true
  error.value = ''
  try {
    await $fetch(`/api/groups/${props.group.id}/position/accept`, { method: 'POST' })
    emit('changed')
  } catch (err) {
    error.value = err?.data?.message || 'Could not accept your position.'
  } finally {
    accepting.value = false
  }
}
</script>
