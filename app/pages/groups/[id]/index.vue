<!-- app/pages/groups/[id]/index.vue -->
<!-- Group overview. -->
<template>
  <div v-if="group" class="flex flex-col gap-5">
    <AppAlert v-if="group.status === 'cancelled'" tone="error">
      This group was cancelled{{ group.cancelledAt ? ` on ${formatLagosDate(group.cancelledAt, 'medium')}` : '' }}.
    </AppAlert>

    <AppAlert v-if="justActivated" tone="success">
      The group has started! Everyone has been told when they pay and when they collect.
    </AppAlert>

    <!-- Before the fee is confirmed -->
    <SetupChecklist v-if="group.status === 'draft'" :group="group" />

    <!-- Gathering members -->
    <template v-if="group.status === 'awaiting_members'">
      <ActivationCard v-if="group.isOwner" :key="refreshKey" :group="group" @activated="onActivated" />
      <MyTodos v-if="me" :group="group" :me="me" @changed="onChanged" />

      <AppCard v-if="group.canManage && group.inviteCode" class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-bold">Invite members</h2>
          <p class="text-text-muted">{{ memberCount }} of {{ group.plannedMemberCount }} joined · code <strong class="tabular tracking-widest">{{ group.inviteCode }}</strong></p>
        </div>
        <AppButton :to="`/groups/${group.id}/invite`" icon="i-lucide-share-2">Share invite</AppButton>
      </AppCard>
    </template>

    <!-- Running -->
    <AppCard v-if="group.status === 'active'" class="flex flex-wrap items-center justify-between gap-3 border-primary/30">
      <div>
        <h2 class="font-bold">The group is running</h2>
        <p class="text-text-muted">Started {{ group.activatedAt ? formatLagosDate(group.activatedAt, 'medium') : '' }}. See who has paid in each round.</p>
      </div>
      <AppButton :to="`/groups/${group.id}/contributions`" icon="i-lucide-hand-coins">Payments</AppButton>
    </AppCard>

    <!-- Finished -->
    <AppCard v-if="group.status === 'completed'" class="flex flex-wrap items-center justify-between gap-3 border-status-confirmed/40">
      <div>
        <h2 class="font-bold">This cycle is complete</h2>
        <p class="text-text-muted">See who paid what and who received their payout.</p>
      </div>
      <AppButton :to="`/groups/${group.id}/summary`" icon="i-lucide-clipboard-list">View summary</AppButton>
    </AppCard>

    <!-- Where members send my payout -->
    <PayoutAccountCard v-if="['awaiting_members', 'active'].includes(group.status)" :group-id="group.id" />

    <AppCard class="flex flex-col gap-4">
      <h2 class="font-bold">How this group works</h2>
      <GroupSummary v-if="group.startDate" :settings="group" />
    </AppCard>
  </div>
</template>

<script setup>
const { group, memberCount, me, refresh } = useGroupDetail()

const justActivated = ref(false)
const refreshKey = ref(0)

async function onChanged() {
  await refresh()
  refreshKey.value++ // re-check readiness
}

async function onActivated() {
  await refresh()
  justActivated.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>
