<!-- app/components/ui/AppInput.vue -->
<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-semibold">
      {{ label }}
      <span v-if="optional" class="font-normal text-text-muted">(optional)</span>
    </label>
    <div class="relative">
      <input
        :id="id"
        v-model="model"
        :type="inputType"
        :autocomplete="autocomplete"
        :inputmode="inputmode || undefined"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="!!error || undefined"
        :aria-describedby="describedBy"
        class="min-h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-text placeholder:text-text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
        :class="[error ? 'border-status-rejected' : 'border-border', type === 'password' && 'pr-12']"
      >
      <button
        v-if="type === 'password'"
        type="button"
        class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-text-muted hover:text-text"
        :aria-label="revealed ? 'Hide password' : 'Show password'"
        @click="revealed = !revealed"
      >
        <Icon :name="revealed ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-5" aria-hidden="true" />
      </button>
    </div>
    <p v-if="hint && !error" :id="`${id}-hint`" class="text-sm text-text-muted">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="flex items-center gap-1.5 text-sm font-medium text-status-rejected">
      <Icon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
  </div>
</template>

<script setup>
const props = defineProps({
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  autocomplete: { type: String, default: 'off' },
  inputmode: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  optional: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

const model = defineModel({ type: String, default: '' })

const id = useId()
const revealed = ref(false)

const inputType = computed(() => (props.type === 'password' && revealed.value ? 'text' : props.type))
const describedBy = computed(() => (props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined))
</script>
