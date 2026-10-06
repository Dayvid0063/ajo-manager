<!-- app/components/group/SetupChecklist.vue -->
<!-- "What's next" for a group that hasn't started yet. -->
<template>
  <AppCard>
    <h2 class="mb-4 font-bold">Getting your group ready</h2>
    <ol class="flex flex-col">
      <li v-for="(step, index) in steps" :key="step.title" class="relative flex gap-3 pb-5 last:pb-0">
        <span
          v-if="index < steps.length - 1"
          class="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5"
          :class="step.state === 'done' ? 'bg-primary' : 'bg-border'"
          aria-hidden="true"
        />
        <span
          class="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold"
          :class="{
            'border-primary bg-primary text-on-primary': step.state === 'done',
            'border-primary bg-primary-soft text-primary': step.state === 'current',
            'border-status-rejected bg-status-rejected-soft text-status-rejected': step.state === 'problem',
            'border-border bg-surface text-text-muted': step.state === 'todo'
          }"
        >
          <Icon v-if="step.state === 'done'" name="i-lucide-check" class="size-4" aria-hidden="true" />
          <Icon v-else-if="step.state === 'problem'" name="i-lucide-x" class="size-4" aria-hidden="true" />
          <span v-else>{{ index + 1 }}</span>
        </span>
        <div class="flex min-w-0 flex-col gap-1 pt-1">
          <p class="font-semibold" :class="step.state === 'todo' && 'text-text-muted'">
            {{ step.title }}
            <span class="sr-only">({{ step.state }})</span>
          </p>
          <p v-if="step.description" class="text-sm text-text-muted">{{ step.description }}</p>
          <AppButton v-if="step.action" :to="step.action.to" class="mt-1 self-start" :variant="step.state === 'problem' ? 'danger' : 'primary'">
            {{ step.action.label }}
          </AppButton>
        </div>
      </li>
    </ol>
  </AppCard>
</template>

<script setup>
const props = defineProps({
  group: { type: Object, required: true }
})

const steps = computed(() => {
  const g = props.group
  const owner = g.isOwner
  const feeDone = g.feeStatus === 'confirmed'
  const feeLink = `/groups/${g.id}/fee`

  const fee = {
    unpaid: { state: 'current', description: 'Pay by bank transfer, then tell us you have paid.', action: owner ? { to: feeLink, label: 'Pay platform fee' } : null },
    pending: { state: 'current', description: 'We are checking our bank for your transfer. This usually takes less than a day.', action: owner ? { to: feeLink, label: 'View payment' } : null },
    rejected: { state: 'problem', description: 'We could not confirm your transfer. See the reason and report it again.', action: owner ? { to: feeLink, label: 'Fix payment' } : null },
    confirmed: { state: 'done', description: '' }
  }[g.feeStatus] ?? { state: 'todo' }

  return [
    { title: 'Group details and rules', state: 'done', description: '' },
    { title: 'Pay the platform fee', ...fee },
    {
      title: 'Invite and approve members',
      state: feeDone ? 'current' : 'todo',
      description: feeDone ? 'Invite links and member approval arrive in the next update.' : `You need ${g.plannedMemberCount} members, including you.`
    },
    { title: 'Members accept the rules and their payout positions', state: 'todo', description: '' },
    { title: 'Start the group', state: 'todo', description: 'Contribution tracking begins.' }
  ]
})
</script>
