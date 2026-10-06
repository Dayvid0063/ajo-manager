<!-- app/pages/groups/[id]/schedule.vue -->
<!-- Who collects in each round, when, and how much. -->
<template>
  <div class="flex flex-col gap-5">
    <p v-if="!rounds.length" class="rounded-card border border-dashed border-border py-10 text-center text-text-muted">
      The schedule is created when the group starts.
    </p>

    <AppCard v-else class="p-0 sm:p-0">
      <ol class="divide-y divide-border">
        <li
          v-for="round in rounds"
          :key="round.id"
          class="flex items-center gap-3 px-4 py-3.5 sm:px-5"
          :class="[round.isMine && 'bg-status-payout-soft', round.isPast && 'opacity-70']"
        >
          <span
            class="tabular inline-flex size-10 shrink-0 items-center justify-center rounded-xl font-extrabold"
            :class="round.isMine ? 'bg-accent text-on-accent' : 'bg-surface-muted text-text-muted'"
          >
            {{ round.index }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-semibold">
              {{ round.recipientName }}
              <span v-if="round.isMine" class="text-status-payout">· your payout</span>
            </p>
            <p class="text-sm text-text-muted">{{ formatLagosDate(round.dueDate) }}</p>
          </div>
          <p class="text-right font-bold" :class="round.isMine && 'text-status-payout'"><MoneyText :kobo="round.expectedPayout" /></p>
        </li>
      </ol>
    </AppCard>
  </div>
</template>

<script setup>
const route = useRoute()
const { data } = await useFetch(() => `/api/groups/${route.params.id}/schedule`)
const rounds = computed(() => data.value?.rounds ?? [])
</script>
