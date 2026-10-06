<!-- app/pages/settings.vue -->
<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-extrabold tracking-tight">Settings</h1>

    <AppCard class="flex flex-col gap-3">
      <div>
        <h2 class="font-bold">Appearance</h2>
        <p class="text-sm text-text-muted">Choose a theme. "System" follows your phone or computer setting.</p>
      </div>
      <ThemeToggle />
    </AppCard>
  </div>
</template>
