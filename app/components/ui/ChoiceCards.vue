<!-- app/components/ui/ChoiceCards.vue -->
<!-- Large, tappable radio options with a title and explanation. -->
<template>
  <fieldset class="flex flex-col gap-1.5">
    <legend class="mb-1.5 text-sm font-semibold">{{ label }}</legend>
    <div class="grid gap-2" :class="columns === 2 ? 'sm:grid-cols-2' : ''">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
        :class="[
          model === option.value ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-muted',
          disabled && 'cursor-not-allowed opacity-60'
        ]"
      >
        <input
          v-model="model"
          type="radio"
          class="sr-only"
          :name="name"
          :value="option.value"
          :disabled="disabled"
        >
        <span
          class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2"
          :class="model === option.value ? 'border-primary' : 'border-border'"
          aria-hidden="true"
        >
          <span v-if="model === option.value" class="size-2.5 rounded-full bg-primary" />
        </span>
        <span class="flex flex-col">
          <span class="font-semibold">{{ option.title }}</span>
          <span v-if="option.description" class="text-sm text-text-muted">{{ option.description }}</span>
        </span>
      </label>
    </div>
    <p v-if="error" class="flex items-center gap-1.5 text-sm font-medium text-status-rejected">
      <Icon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
  </fieldset>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true }, // [{ value, title, description? }]
  error: { type: String, default: '' },
  columns: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false }
})

const model = defineModel({ type: [String, Boolean, Number, null], default: null })
const name = useId()
</script>
