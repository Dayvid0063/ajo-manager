<!-- app/pages/profile/setup.vue -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="text-sm font-semibold text-primary">One last step</p>
      <h1 class="text-3xl font-extrabold tracking-tight">Tell us your name</h1>
      <p class="mt-1 text-text-muted">This is how members of your groups will see you, so use the name they know.</p>
    </div>

    <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

      <AppInput
        v-model="values.name"
        label="Full name"
        autocomplete="name"
        placeholder="e.g. Adaeze Okafor"
        :error="fieldError('name')"
      />
      <AppInput
        v-model="values.phone"
        label="Phone number"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        placeholder="e.g. 0803 123 4567"
        hint="Helps your group admin reach you. Not used to log in."
        optional
        :error="fieldError('phone')"
      />

      <AppButton type="submit" :loading="pending" block>Continue</AppButton>
    </form>
  </div>
</template>

<script setup>
import { profileSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Your profile · Ajo Manager' })

const { refreshSession } = useAuth()
const { values, formError, pending, fieldError, submit } = useForm(profileSchema, { name: '', phone: '' })

async function onSubmit() {
  const done = await submit(async (data) => {
    await $fetch('/api/me/profile', { method: 'PATCH', body: data })
    await refreshSession()
    return true
  })
  if (done) {
    await navigateTo('/home')
  }
}
</script>
