<!-- app/pages/register.vue -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">Create your account</h1>
      <p class="mt-1 text-text-muted">It's free. You'll add your name on the next step.</p>
    </div>

    <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

      <AppInput
        v-model="values.email"
        label="Email address"
        type="email"
        inputmode="email"
        autocomplete="email"
        :error="fieldError('email')"
      />
      <AppInput
        v-model="values.password"
        label="Password"
        type="password"
        autocomplete="new-password"
        hint="At least 8 characters."
        :error="fieldError('password')"
      />
      <AppInput
        v-model="values.confirmPassword"
        label="Confirm password"
        type="password"
        autocomplete="new-password"
        :error="fieldError('confirmPassword')"
      />

      <AppButton type="submit" :loading="pending" block>Create account</AppButton>
    </form>

    <p class="text-center text-text-muted">
      Already have an account?
      <NuxtLink :to="{ path: '/login', query: route.query }" class="font-semibold text-primary hover:underline">Log in</NuxtLink>
    </p>
  </div>
</template>

<script setup>
import { registerSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Create account · Ajo Manager' })

const route = useRoute()
const { register } = useAuth()
const { values, formError, pending, fieldError, submit } = useForm(registerSchema, {
  email: '',
  password: '',
  confirmPassword: ''
})

async function onSubmit() {
  const done = await submit(async (data) => {
    await register(data)
    return true
  })
  if (done) {
    await navigateTo({ path: '/profile/setup', query: { redirect: safeRedirect(route.query.redirect) } })
  }
}
</script>
