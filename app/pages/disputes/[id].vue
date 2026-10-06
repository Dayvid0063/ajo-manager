<!-- app/pages/disputes/[id].vue -->
<template>
  <div class="flex flex-col gap-5">
    <NuxtLink
      :to="dispute ? `/groups/${dispute.group.id}/disputes` : '/groups'"
      class="inline-flex items-center gap-1 self-start text-sm font-semibold text-text-muted hover:text-text"
    >
      <Icon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> Disputes
    </NuxtLink>
    <AppAlert v-if="error" tone="error">We could not find this dispute.</AppAlert>
    <DisputeThread v-else-if="dispute" :dispute="dispute" @updated="refresh" />
  </div>
</template>

<script setup>
useHead({ title: 'Dispute · Ajo Manager' })

const route = useRoute()
const { data: dispute, error, refresh } = await useFetch(() => `/api/disputes/${route.params.id}`)
</script>
