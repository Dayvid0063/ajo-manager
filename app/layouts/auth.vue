<!-- app/layouts/auth.vue -->
<!-- Welcome, register, log in: a single centered column. -->
<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex items-center justify-between px-4 py-4 sm:px-6">
      <NuxtLink to="/">
        <AppLogo />
      </NuxtLink>
      <ThemeToggle compact />
    </header>
    <main id="main" class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
      <slot />
    </main>
  </div>
</template>
