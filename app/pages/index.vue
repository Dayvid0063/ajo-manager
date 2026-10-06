<!-- app/pages/index.vue -->
<template>
  <div class="flex flex-col gap-8 py-6">
    <div class="flex flex-col gap-4">
      <span class="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
        <Icon name="i-lucide-shield-check" class="size-4" aria-hidden="true" />
        Ajo · Esusu · Adashe
      </span>
      <h1 class="text-4xl font-extrabold leading-tight tracking-tight">
        Run your contribution group with <span class="text-primary">clarity</span> and <span class="text-accent">trust</span>.
      </h1>
      <p class="text-lg text-text-muted">
        See who pays whom and when, record every payment, and keep a clear history everyone can trust — no more lost WhatsApp messages or notebooks.
      </p>
    </div>

    <AppCard class="flex flex-col gap-3">
      <div v-for="point in points" :key="point.text" class="flex items-start gap-3">
        <span class="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon :name="point.icon" class="size-5" aria-hidden="true" />
        </span>
        <p class="pt-1.5">{{ point.text }}</p>
      </div>
    </AppCard>

    <div class="flex flex-col gap-3">
      <AppButton to="/register" block>Create a free account</AppButton>
      <AppButton to="/login" variant="secondary" block>I already have an account</AppButton>
    </div>

    <p class="text-center text-sm text-text-muted">
      Ajo Manager keeps records only. Members pay each other directly — the app never holds your money.
    </p>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'auth' })

const points = [
  { icon: 'i-lucide-calendar-check', text: 'Know exactly how much to pay, who to pay and when.' },
  { icon: 'i-lucide-circle-check', text: 'Payments are confirmed by the person who received them.' },
  { icon: 'i-lucide-bell-ring', text: 'Friendly reminders before every due date.' }
]
</script>
