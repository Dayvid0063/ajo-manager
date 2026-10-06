<!-- app/pages/groups/[id]/rules.vue -->
<template>
  <div v-if="group" class="flex flex-col gap-5">
    <AppCard v-if="!editing" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-bold">Group rules</h2>
          <p v-if="rules" class="text-sm text-text-muted">
            Version {{ rules.version }} · updated {{ formatLagosDate(rules.publishedAt, 'medium') }}
          </p>
        </div>
        <AppButton v-if="canEdit" variant="secondary" icon="i-lucide-pencil" @click="startEditing">Edit rules</AppButton>
      </div>
      <p v-if="rules" class="whitespace-pre-line leading-relaxed">{{ rules.body }}</p>
      <p v-else class="text-text-muted">No rules yet.</p>
    </AppCard>

    <AppCard v-else as="form" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <h2 class="font-bold">Edit rules</h2>
      <AppAlert v-if="group.status === 'awaiting_members'" tone="warning">
        Saving publishes a new version. Members who already accepted the rules will need to accept the new version.
      </AppAlert>
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>
      <AppTextarea v-model="values.rules" label="Rules" :rows="16" :error="fieldError('rules')" />
      <div class="flex gap-3">
        <AppButton variant="secondary" @click="editing = false">Cancel</AppButton>
        <AppButton type="submit" :loading="pending" class="flex-1">Save rules</AppButton>
      </div>
    </AppCard>
  </div>
</template>

<script setup>
import { rulesSchema } from '#shared/schemas/group'

const route = useRoute()
const { group, rules, refresh } = useGroupDetail()

const canEdit = computed(() => group.value?.canManage && ['draft', 'awaiting_members'].includes(group.value?.status))
const editing = ref(false)

const { values, formError, pending, fieldError, submit } = useForm(rulesSchema, { rules: '' })

function startEditing() {
  values.rules = rules.value?.body ?? ''
  editing.value = true
}

async function onSubmit() {
  const result = await submit(data => $fetch(`/api/groups/${route.params.id}/rules`, { method: 'PUT', body: data }))
  if (result) {
    await refresh()
    editing.value = false
  }
}
</script>
