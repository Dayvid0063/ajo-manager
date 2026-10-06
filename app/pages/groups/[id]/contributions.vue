<!-- app/pages/groups/[id]/contributions.vue -->
<!-- The group's payment board: each round, who has paid, and claims to review. -->
<template>
  <div class="flex flex-col gap-4">
    <p v-if="!rounds.length" class="rounded-card border border-dashed border-border py-10 text-center text-text-muted">
      Payment tracking starts when the group starts.
    </p>

    <details
      v-for="round in rounds"
      :key="round.id"
      :open="round.index === data.currentRound || undefined"
      class="group/round rounded-card border bg-surface shadow-card"
      :class="round.index === data.currentRound ? 'border-primary/40' : 'border-border'"
    >
      <summary class="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5">
        <span
          class="tabular inline-flex size-10 shrink-0 items-center justify-center rounded-xl font-extrabold"
          :class="round.isRecipient ? 'bg-accent text-on-accent' : round.status === 'completed' ? 'bg-status-confirmed-soft text-status-confirmed' : 'bg-surface-muted text-text-muted'"
        >
          {{ round.index }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold">
            {{ round.isRecipient ? 'Your payout' : round.recipientName }}
            <span v-if="round.index === data.currentRound" class="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">Current</span>
          </p>
          <p class="text-sm text-text-muted">{{ round.dueLabel }} · <MoneyText :kobo="round.expectedPayout" /></p>
        </div>
        <span class="tabular text-sm font-bold" :class="round.confirmedCount === round.total ? 'text-status-confirmed' : 'text-text-muted'">
          {{ round.confirmedCount }}/{{ round.total }} paid
        </span>
        <Icon name="i-lucide-chevron-down" class="size-5 text-text-muted transition-transform group-open/round:rotate-180" aria-hidden="true" />
      </summary>

      <ul class="divide-y divide-border border-t border-border">
        <li v-for="item in round.obligations" :key="item.id" class="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <NuxtLink v-if="item.isMine || item.latestRecord" :to="`/payments/${item.id}`" class="font-semibold hover:underline">
              {{ item.isMine ? 'You' : item.contributorName }}
            </NuxtLink>
            <span v-else class="font-semibold">{{ item.contributorName }}</span>
            <StatusChip :status="item.displayStatus" />
          </div>
          <RecordCard
            v-if="item.latestRecord?.canReview"
            :record="item.latestRecord"
            :who="item.contributorName"
            @reviewed="refresh"
          />
        </li>
      </ul>
    </details>
  </div>
</template>

<script setup>
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/groups/${route.params.id}/contributions`)
const rounds = computed(() => data.value?.rounds ?? [])
</script>
