<!-- app/components/ui/AppTextarea.vue -->
<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-semibold">
      {{ label }}
      <span v-if="optional" class="font-normal text-text-muted">(optional)</span>
    </label>
    <textarea
      :id="id"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
      class="w-full rounded-xl border bg-surface px-3.5 py-3 text-base leading-relaxed text-text placeholder:text-text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-muted"
      :class="error ? 'border-status-rejected' : 'border-border'"
    />
    <p v-if="hint && !error" :id="`${id}-hint`" class="text-sm text-text-muted">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="flex items-center gap-1.5 text-sm font-medium text-status-rejected">
      <Icon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  rows: { type: Number, default: 4 },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  optional: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

const model = defineModel({ type: String, default: '' })
const id = useId()
</script>
