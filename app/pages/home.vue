<!-- app/pages/home.vue -->
<!-- Home dashboard (brief §8): How much do I owe? Who am I paying? When is it
     due? What's the status? When is my payout? -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="text-text-muted">Welcome back</p>
      <h1 class="text-2xl font-extrabold tracking-tight">{{ firstName }}</h1>
    </div>

    <!-- Waiting for me to confirm -->
    <NuxtLink
      v-if="dash?.toReview"
      to="/payments/review"
      class="flex items-center gap-3 rounded-card border-2 border-dashed border-status-submitted bg-status-submitted-soft p-4"
    >
      <Icon name="i-lucide-hourglass" class="size-6 shrink-0 text-status-submitted" aria-hidden="true" />
      <span class="flex-1 font-semibold">
        {{ dash.toReview }} {{ dash.toReview === 1 ? 'payment is' : 'payments are' }} waiting for you to confirm
      </span>
      <Icon name="i-lucide-chevron-right" class="size-5 text-status-submitted" aria-hidden="true" />
    </NuxtLink>

    <!-- What I owe, per group -->
    <section v-if="dash?.toPay.length" class="flex flex-col gap-3">
      <h2 class="text-sm font-bold uppercase tracking-wide text-text-muted">To pay</h2>
      <AppCard
        v-for="item in dash.toPay"
        :key="item.obligationId"
        class="flex flex-col gap-4"
        :class="item.displayStatus === 'submitted' && '!border-2 !border-dashed !border-status-submitted'"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-text-muted">{{ item.groupName }} · Round {{ item.roundIndex }}</p>
            <p class="mt-1 text-3xl font-extrabold"><MoneyText :kobo="item.amount" /></p>
          </div>
          <StatusChip :status="item.displayStatus" />
        </div>

        <dl class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl bg-surface-muted p-3">
            <dt class="text-sm text-text-muted">Who you are paying</dt>
            <dd class="font-bold">{{ item.recipientName }}</dd>
          </div>
          <div class="rounded-xl bg-surface-muted p-3">
            <dt class="text-sm text-text-muted">Due date</dt>
            <dd class="font-bold">{{ formatLagosDate(item.dueDate) }}</dd>
            <dd v-if="!['submitted'].includes(item.displayStatus)" class="text-sm" :class="item.displayStatus === 'overdue' ? 'font-semibold text-status-overdue' : 'text-text-muted'">{{ item.dueText }}</dd>
          </div>
        </dl>

        <p v-if="item.displayStatus === 'submitted'" class="text-sm text-text-muted">
          You marked this as paid. {{ item.recipientName }} still needs to confirm they received it.
        </p>
        <AppButton :to="`/payments/${item.obligationId}`" :variant="item.displayStatus === 'submitted' ? 'secondary' : 'primary'" block>
          {{ item.displayStatus === 'submitted' ? 'View payment' : item.displayStatus === 'rejected' ? 'See why and fix' : 'Pay and mark as paid' }}
        </AppButton>
      </AppCard>
    </section>

    <!-- My payouts -->
    <section v-if="dash?.payouts.length" class="flex flex-col gap-3">
      <h2 class="text-sm font-bold uppercase tracking-wide text-text-muted">Your payout</h2>
      <NuxtLink
        v-for="payout in dash.payouts"
        :key="payout.groupId"
        :to="`/groups/${payout.groupId}/contributions`"
        class="flex items-center gap-4 rounded-card border border-status-payout/30 bg-status-payout-soft p-4 sm:p-5"
      >
        <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <Icon name="i-lucide-gift" class="size-6" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-status-payout">{{ payout.groupName }} · Round {{ payout.roundIndex }}</p>
          <p class="font-bold"><MoneyText :kobo="payout.expectedPayout" /> on {{ formatLagosDate(payout.dueDate) }}</p>
          <p class="text-sm text-text-muted">{{ payout.confirmed }} of {{ payout.total }} payments confirmed</p>
        </div>
      </NuxtLink>
    </section>

    <!-- Nothing running yet -->
    <AppCard v-if="dash && !dash.toPay.length && !dash.payouts.length" class="flex flex-col items-center gap-4 py-10 text-center">
      <span class="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon name="i-lucide-sparkles" class="size-7" aria-hidden="true" />
      </span>
      <div>
        <p class="text-lg font-bold">{{ dash.activeGroups ? 'You\'re all caught up' : 'No running groups yet' }}</p>
        <p class="mx-auto max-w-sm text-text-muted">
          {{ dash.activeGroups ? 'Nothing to pay right now. We\'ll remind you before your next payment.' : 'Your payments and payouts appear here once a group starts.' }}
        </p>
      </div>
      <div v-if="!dash.activeGroups" class="flex w-full max-w-xs flex-col gap-2">
        <AppButton to="/groups" block>My groups</AppButton>
        <AppButton to="/join" variant="secondary" block>Join with a code</AppButton>
      </div>
    </AppCard>
  </div>
</template>

<script setup>
useHead({ title: 'Home · Ajo Manager' })

const { user } = useUserSession()
const firstName = computed(() => user.value?.name?.split(/\s+/)[0] || 'Your dashboard')

const { data: dash } = await useFetch('/api/me/dashboard')
</script>
