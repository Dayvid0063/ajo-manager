<!-- app/pages/groups/[id]/index.vue -->
<!-- Group overview. -->
<template>
  <div v-if="group" class="flex flex-col gap-5">
    <AppAlert v-if="group.status === 'cancelled'" tone="error">
      This group was cancelled{{ group.cancelledAt ? ` on ${formatLagosDate(group.cancelledAt, 'medium')}` : '' }}.
    </AppAlert>

    <SetupChecklist v-if="['draft', 'awaiting_members'].includes(group.status)" :group="group" />

    <AppCard v-if="group.inviteCode" class="flex flex-col gap-2 border-primary/30">
      <h2 class="font-bold">Invite code</h2>
      <p class="tabular text-3xl font-extrabold tracking-[0.2em] text-primary">{{ group.inviteCode }}</p>
      <p class="text-sm text-text-muted">Invite links, QR codes and join requests arrive in the next update.</p>
    </AppCard>

    <AppCard class="flex flex-col gap-4">
      <h2 class="font-bold">How this group works</h2>
      <GroupSummary v-if="group.startDate" :settings="group" />
    </AppCard>

    <AppCard class="flex items-center justify-between gap-3">
      <div>
        <h2 class="font-bold">Members</h2>
        <p class="text-text-muted">{{ memberCount }} of {{ group.plannedMemberCount }} joined</p>
      </div>
      <span class="tabular text-2xl font-extrabold text-primary">{{ memberCount }}/{{ group.plannedMemberCount }}</span>
    </AppCard>
  </div>
</template>

<script setup>
const { group, memberCount } = useGroupDetail()
</script>
