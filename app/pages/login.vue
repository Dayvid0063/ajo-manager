<!-- app/pages/login.vue -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p class="mt-1 text-text-muted">Log in to see your groups and payments.</p>
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
        autocomplete="current-password"
        :error="fieldError('password')"
      />

      <NuxtLink to="/forgot-password" class="-mt-1 self-end text-sm font-semibold text-primary hover:underline">
        Forgot password?
      </NuxtLink>

      <AppButton type="submit" :loading="pending" block>Log in</AppButton>
    </form>

    <p class="text-center text-text-muted">
      New here?
      <NuxtLink :to="{ path: '/register', query: route.query }" class="font-semibold text-primary hover:underline">Create a free account</NuxtLink>
    </p>
  </div>
</template>

<script setup>
import { loginSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Log in · Ajo Manager' })

const route = useRoute()
const { login } = useAuth()
const { values, formError, pending, fieldError, submit } = useForm(loginSchema, { email: '', password: '' })

async function onSubmit() {
  const done = await submit(async (data) => {
    await login(data)
    return true
  })
  if (done) {
    await navigateTo(safeRedirect(route.query.redirect))
  }
}
</script>
