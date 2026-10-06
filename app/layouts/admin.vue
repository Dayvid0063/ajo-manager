<!-- app/layouts/admin.vue -->
<!-- Platform-admin area. Access is enforced by the server; this is layout only. -->
<template>
  <div class="min-h-dvh lg:flex">
    <aside class="border-b border-border bg-surface px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:py-6">
      <div class="mb-4 flex items-center justify-between lg:mb-8 lg:block lg:px-2">
        <NuxtLink to="/admin" class="flex items-center gap-2">
          <AppLogo />
        </NuxtLink>
        <span class="rounded-full bg-status-fee-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-status-fee lg:mt-3 lg:inline-block">
          Platform admin
        </span>
      </div>
      <nav aria-label="Admin" class="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col lg:overflow-visible">
        <NuxtLink
          v-for="item in ADMIN_NAV"
          :key="item.to"
          :to="item.to"
          class="flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 font-semibold text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          exact-active-class="!bg-primary-soft !text-primary"
        >
          <Icon :name="item.icon" class="size-5" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>
    <main id="main" class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { ADMIN_NAV } from '~/utils/navigation'
</script>
