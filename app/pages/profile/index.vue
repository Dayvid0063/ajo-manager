<!-- app/pages/profile/index.vue -->
<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-extrabold tracking-tight">Profile</h1>

    <AppAlert v-if="route.query.updated === 'password'" tone="success">
      Your password was changed. Other devices have been logged out.
    </AppAlert>

    <AppCard class="flex items-center gap-4">
      <span class="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-xl font-extrabold text-primary">
        {{ initials }}
      </span>
      <div class="min-w-0">
        <p class="truncate text-lg font-bold">{{ me?.name }}</p>
        <p class="truncate text-text-muted">{{ me?.email }}</p>
      </div>
    </AppCard>

    <AppCard as="form" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <h2 class="font-bold">Your details</h2>
      <AppAlert v-if="saved" tone="success">Saved.</AppAlert>
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

      <AppInput v-model="values.name" label="Full name" autocomplete="name" :error="fieldError('name')" />
      <AppInput
        v-model="values.phone"
        label="Phone number"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        optional
        :error="fieldError('phone')"
      />
      <AppInput :model-value="me?.email" label="Email address" hint="Contact support to change your email." disabled />

      <AppButton type="submit" :loading="pending" class="self-start">Save changes</AppButton>
    </AppCard>

    <AppCard class="flex flex-col divide-y divide-border p-0 sm:p-0">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="flex min-h-14 items-center gap-3 px-4 hover:bg-surface-muted sm:px-5">
        <Icon :name="link.icon" class="size-5 text-text-muted" aria-hidden="true" />
        <span class="flex-1 font-semibold">{{ link.label }}</span>
        <Icon name="i-lucide-chevron-right" class="size-5 text-text-muted" aria-hidden="true" />
      </NuxtLink>
    </AppCard>

    <AppButton variant="secondary" icon="i-lucide-log-out" block @click="logout">Log out</AppButton>
  </div>
</template>

<script setup>
import { profileSchema } from '#shared/schemas/auth'

useHead({ title: 'Profile · Ajo Manager' })

const route = useRoute()
const { user, refreshSession, logout } = useAuth()
const { data: me } = await useFetch('/api/me')

const { values, formError, pending, fieldError, submit } = useForm(profileSchema, {
  name: me.value?.name ?? '',
  phone: me.value?.phone ?? ''
})
const saved = ref(false)

const initials = computed(() =>
  (me.value?.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
)

const links = computed(() => [
  { to: '/change-password', label: 'Change password', icon: 'i-lucide-key-round' },
  { to: '/settings', label: 'Settings', icon: 'i-lucide-settings' },
  ...(user.value?.isPlatformAdmin ? [{ to: '/admin', label: 'Platform admin', icon: 'i-lucide-shield-check' }] : [])
])

async function onSubmit() {
  saved.value = false
  const result = await submit(data => $fetch('/api/me/profile', { method: 'PATCH', body: data }))
  if (result) {
    me.value = { ...me.value, name: result.user.name, phone: result.phone }
    await refreshSession()
    saved.value = true
  }
}
</script>
