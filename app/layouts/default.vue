<!-- app/layouts/default.vue -->
<!-- Member area: bottom tab bar on phones, left sidebar on desktop (lg+). -->
<template>
  <div class="min-h-dvh lg:flex">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
      Skip to content
    </a>

    <!-- Desktop sidebar -->
    <aside class="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
      <NuxtLink to="/home" class="mb-8 px-2">
        <AppLogo />
      </NuxtLink>
      <nav aria-label="Main" class="flex flex-1 flex-col gap-1">
        <NuxtLink
          v-for="item in MEMBER_NAV"
          :key="item.to"
          :to="item.to"
          class="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          active-class="!bg-primary-soft !text-primary"
        >
          <Icon :name="item.icon" class="size-5" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <NuxtLink
        v-if="user?.isPlatformAdmin"
        to="/admin"
        class="mb-3 flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-status-fee hover:bg-status-fee-soft"
      >
        <Icon name="i-lucide-shield-check" class="size-5" aria-hidden="true" />
        Platform admin
      </NuxtLink>
      <ThemeToggle compact />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Mobile top bar -->
      <header class="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <NuxtLink to="/home">
          <AppLogo />
        </NuxtLink>
        <NuxtLink to="/settings" class="inline-flex size-11 items-center justify-center rounded-xl text-text-muted hover:bg-surface-muted" aria-label="Settings">
          <Icon name="i-lucide-settings" class="size-5" aria-hidden="true" />
        </NuxtLink>
      </header>

      <main id="main" class="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
        <slot />
      </main>
    </div>

    <!-- Mobile bottom tab bar -->
    <nav
      aria-label="Main"
      class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <NuxtLink
        v-for="item in MEMBER_NAV"
        :key="item.to"
        :to="item.to"
        class="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-text-muted"
        active-class="!text-primary"
      >
        <Icon :name="item.icon" class="size-6" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
import { MEMBER_NAV } from '~/utils/navigation'

const { user } = useUserSession()
</script>
