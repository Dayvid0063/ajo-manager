<!-- app/pages/home.vue -->
<!-- PLACEHOLDER (Phase 5 builds the real dashboard). The hero card below uses
     SAMPLE DATA ONLY to preview the design — nothing here is real. -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="text-text-muted">Welcome back</p>
      <h1 class="text-2xl font-extrabold tracking-tight">{{ firstName }}</h1>
    </div>

    <p class="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-text-muted">
      <Icon name="i-lucide-flask-conical" class="size-4 shrink-0" aria-hidden="true" />
      Design preview with sample data. Your real groups appear here in Phase 5.
    </p>

    <!-- What do I owe? Who am I paying? When? Status? -->
    <AppCard class="flex flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-text-muted">{{ sample.groupName }} · Round {{ sample.round }} of {{ sample.rounds }}</p>
          <p class="mt-1 text-3xl font-extrabold"><MoneyText :kobo="sample.amountKobo" /></p>
        </div>
        <StatusChip status="due" />
      </div>

      <dl class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-surface-muted p-3">
          <dt class="text-sm text-text-muted">Who you are paying</dt>
          <dd class="font-bold">{{ sample.recipient }}</dd>
        </div>
        <div class="rounded-xl bg-surface-muted p-3">
          <dt class="text-sm text-text-muted">Due date</dt>
          <dd class="font-bold">{{ sample.dueDate }}</dd>
        </div>
      </dl>

      <AppButton icon="i-lucide-check" block disabled>Mark as paid</AppButton>
    </AppCard>

    <!-- When is my payout? -->
    <section class="flex items-center gap-4 rounded-card border border-status-payout/30 bg-status-payout-soft p-4 sm:p-5">
      <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
        <Icon name="i-lucide-gift" class="size-6" aria-hidden="true" />
      </span>
      <div>
        <p class="text-sm font-semibold text-status-payout">Your payout</p>
        <p class="font-bold">
          <MoneyText :kobo="sample.payoutKobo" /> on {{ sample.payoutDate }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
const { user } = useUserSession()
const firstName = computed(() => user.value?.name?.split(/\s+/)[0] || 'Your dashboard')

// SAMPLE DATA — for the design preview only.
const sample = {
  groupName: 'Sample Ajo Group',
  round: 3,
  rounds: 10,
  amountKobo: 2000000,
  recipient: 'Sample Member',
  dueDate: 'Friday, 28 February',
  payoutKobo: 18000000,
  payoutDate: 'Saturday, 31 May'
}
</script>
