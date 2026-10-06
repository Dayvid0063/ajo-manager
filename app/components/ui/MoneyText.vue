<!-- app/components/ui/MoneyText.vue -->
<template>
  <span class="tabular whitespace-nowrap">{{ text }}</span>
</template>

<script setup>
// Always pass integer kobo. Formatting lives in shared/utils/money.ts.
const props = defineProps({
  kobo: { type: Number, required: true }
})

const text = computed(() => formatKobo(props.kobo))
</script>
