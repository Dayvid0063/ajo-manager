<!-- app/pages/groups/index.vue -->
<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-extrabold tracking-tight">My groups</h1>
      <div v-if="groups.length || pending.length" class="flex gap-2">
        <AppButton to="/join" variant="secondary" icon="i-lucide-ticket">Join</AppButton>
        <AppButton to="/groups/new" icon="i-lucide-plus">Create group</AppButton>
      </div>
    </div>

    <AppAlert v-if="error" tone="error">We couldn't load your groups. Please refresh the page.</AppAlert>

    <section v-if="pending.length" class="flex flex-col gap-2">
      <h2 class="text-sm font-bold uppercase tracking-wide text-text-muted">Waiting for approval</h2>
      <NuxtLink
        v-for="request in pending"
        :key="request.inviteCode"
        :to="`/join/${request.inviteCode}`"
        class="flex items-center justify-between gap-3 rounded-card border-2 border-dashed border-status-submitted/60 bg-surface p-4"
      >
        <span class="font-semibold">{{ request.name }}</span>
        <StatusChip status="submitted" label="Request sent" />
      </NuxtLink>
    </section>

    <div v-if="groups.length" class="grid gap-3">
      <GroupCard v-for="group in groups" :key="group.id" :group="group" />
    </div>

    <AppCard v-else-if="status !== 'pending' && !error && !pending.length" class="flex flex-col items-center gap-4 py-10 text-center">
      <span class="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon name="i-lucide-users-round" class="size-7" aria-hidden="true" />
      </span>
      <div>
        <p class="text-lg font-bold">You're not in any group yet</p>
        <p class="mx-auto max-w-sm text-text-muted">Start a group for your family, friends or colleagues, or join one with an invite code.</p>
      </div>
      <div class="flex w-full max-w-xs flex-col gap-2">
        <AppButton to="/groups/new" icon="i-lucide-plus" block>Create a group</AppButton>
        <AppButton to="/join" variant="secondary" icon="i-lucide-ticket" block>Join with a code</AppButton>
      </div>
    </AppCard>
  </div>
</template>

<script setup>
useHead({ title: 'My groups · Ajo Manager' })

const { data, status, error } = await useFetch('/api/groups')
const groups = computed(() => data.value?.items ?? [])
const pending = computed(() => data.value?.pending ?? [])
</script>
