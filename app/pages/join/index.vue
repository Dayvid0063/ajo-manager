<!-- app/pages/join/index.vue -->
<!-- Enter an invite code. -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">Join a group</h1>
      <p class="mt-1 text-text-muted">Enter the 6-character code the group owner shared with you.</p>
    </div>

    <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <AppInput
        v-model="code"
        label="Invite code"
        placeholder="e.g. DT46G8"
        autocomplete="off"
        :error="error"
        class="[&_input]:tabular [&_input]:text-center [&_input]:text-2xl [&_input]:font-bold [&_input]:uppercase [&_input]:tracking-[0.3em]"
      />
      <AppButton type="submit" icon="i-lucide-arrow-right" block>Find group</AppButton>
    </form>

    <AppButton :to="loggedIn ? '/groups' : '/'" variant="ghost" icon="i-lucide-arrow-left" block>Back</AppButton>
  </div>
</template>

<script setup>
import { inviteCodeSchema } from '#shared/schemas/membership'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Join a group · Ajo Manager' })

const { loggedIn } = useUserSession()
const code = ref('')
const error = ref('')

async function onSubmit() {
  const result = inviteCodeSchema.safeParse(code.value)
  if (!result.success) {
    error.value = result.error.issues[0]?.message ?? 'Check the code'
    return
  }
  await navigateTo(`/join/${result.data}`)
}
</script>
