<!-- app/pages/change-password.vue -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">{{ forced ? 'Choose a new password' : 'Change password' }}</h1>
      <p class="mt-1 text-text-muted">
        {{ forced ? 'You logged in with a temporary password. Set your own password to continue.' : 'You will stay logged in on this device. Other devices will be logged out.' }}
      </p>
    </div>

    <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

      <AppInput
        v-model="values.currentPassword"
        :label="forced ? 'Temporary password' : 'Current password'"
        type="password"
        autocomplete="current-password"
        :error="fieldError('currentPassword')"
      />
      <AppInput
        v-model="values.newPassword"
        label="New password"
        type="password"
        autocomplete="new-password"
        hint="At least 8 characters."
        :error="fieldError('newPassword')"
      />
      <AppInput
        v-model="values.confirmPassword"
        label="Confirm new password"
        type="password"
        autocomplete="new-password"
        :error="fieldError('confirmPassword')"
      />

      <AppButton type="submit" :loading="pending" block>Save new password</AppButton>
      <AppButton v-if="forced" variant="ghost" block @click="logout">Log out</AppButton>
      <AppButton v-else to="/profile" variant="ghost" block>Cancel</AppButton>
    </form>
  </div>
</template>

<script setup>
import { changePasswordSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Change password · Ajo Manager' })

const { user, refreshSession, logout } = useAuth()
const forced = computed(() => user.value?.mustChangePassword === true)

const { values, formError, pending, fieldError, submit } = useForm(changePasswordSchema, {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

async function onSubmit() {
  const done = await submit(async (data) => {
    await $fetch('/api/auth/change-password', { method: 'POST', body: data })
    await refreshSession()
    return true
  })
  if (done) {
    await navigateTo({ path: '/profile', query: { updated: 'password' } })
  }
}
</script>
