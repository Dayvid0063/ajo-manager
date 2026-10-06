<!-- app/pages/payments/review.vue -->
<!-- Payments waiting for my confirmation, across all my groups. -->
<template>
  <div class="flex flex-col gap-6">
    <NuxtLink to="/home" class="inline-flex items-center gap-1 self-start text-sm font-semibold text-text-muted hover:text-text">
      <Icon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> Home
    </NuxtLink>
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Payments to confirm</h1>
      <p class="text-text-muted">Check your bank (or cash) before confirming. Only confirm money that has actually arrived.</p>
    </div>

    <AppAlert v-if="message" tone="success">{{ message }}</AppAlert>

    <AppCard v-if="!items.length" class="flex flex-col items-center gap-3 py-10 text-center">
      <Icon name="i-lucide-circle-check" class="size-10 text-status-confirmed" aria-hidden="true" />
      <p class="font-semibold">{{ status === 'pending' ? 'Loading…' : 'Nothing waiting for you' }}</p>
    </AppCard>

    <AppCard v-for="item in items" :key="item.record.id" class="flex flex-col gap-3">
      <p class="text-sm font-semibold text-text-muted">
        <NuxtLink :to="`/groups/${item.groupId}/contributions`" class="hover:underline">{{ item.groupName }}</NuxtLink>
        · Round {{ item.roundIndex }} ·
        {{ item.isMyRound ? 'paid to you' : `paid to ${item.recipientName}` }}
      </p>
      <RecordCard :record="item.record" :who="item.payerName" @reviewed="onReviewed(item, $event)" />
    </AppCard>
  </div>
</template>

<script setup>
useHead({ title: 'Payments to confirm · Ajo Manager' })

const { data, status, refresh } = await useFetch('/api/me/reviews')
const items = computed(() => data.value?.items ?? [])
const message = ref('')

async function onReviewed(item, action) {
  message.value = action === 'confirm'
    ? `Confirmed ${item.payerName}'s payment.`
    : `${item.payerName} has been told the payment wasn't received.`
  await refresh()
}
</script>
