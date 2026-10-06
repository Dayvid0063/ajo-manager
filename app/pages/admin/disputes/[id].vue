<!-- app/pages/admin/disputes/[id].vue -->
<template>
  <div class="flex flex-col gap-5">
    <NuxtLink to="/admin/disputes" class="inline-flex items-center gap-1 self-start text-sm font-semibold text-text-muted hover:text-text">
      <Icon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> Disputes
    </NuxtLink>
    <AppAlert v-if="error" tone="error">Dispute not found.</AppAlert>
    <template v-else-if="dispute">
      <AppAlert tone="info">You're replying as <strong>Ajo Manager support</strong>.</AppAlert>
      <DisputeThread :dispute="dispute" :link-payments="false" @updated="refresh" />
      <AppButton :to="`/admin/groups/${dispute.group.id}`" variant="secondary" icon="i-lucide-users-round" class="self-start">View group</AppButton>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
useHead({ title: 'Dispute · Platform admin' })

const route = useRoute()
const { data: dispute, error, refresh } = await useFetch(() => `/api/disputes/${route.params.id}`)
</script>
