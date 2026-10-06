<!-- app/pages/forgot-password.vue -->
<!-- v1: no email provider, so resets are done by a platform admin (brief §16). -->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
      <p class="mt-1 text-text-muted">No problem — our support team can help you get back in.</p>
    </div>

    <AppCard class="flex flex-col gap-4">
      <ol class="flex flex-col gap-3">
        <li v-for="(step, index) in steps" :key="step" class="flex items-start gap-3">
          <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
            {{ index + 1 }}
          </span>
          <span class="pt-0.5">{{ step }}</span>
        </li>
      </ol>
    </AppCard>

    <AppAlert tone="warning">
      We will never ask for your password. Only accept a temporary password you requested.
    </AppAlert>

    <AppButton to="/login" variant="secondary" icon="i-lucide-arrow-left" block>Back to log in</AppButton>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'auth' })
useHead({ title: 'Forgot password · Ajo Manager' })

const steps = [
  'Contact Ajo Manager support from the email address you registered with.',
  'After confirming it\'s you, support gives you a temporary password.',
  'Log in with it — you\'ll be asked to choose a new password straight away.'
]
</script>
