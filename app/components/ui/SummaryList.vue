<!-- app/components/ui/SummaryList.vue -->
<!-- Label / value rows, e.g. a group's settings. Values may be slotted by key. -->
<template>
  <dl class="divide-y divide-border">
    <div v-for="item in items" :key="item.key" class="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt class="text-sm text-text-muted">{{ item.label }}</dt>
      <dd class="font-semibold sm:text-right">
        <slot :name="item.key" :item="item">{{ item.value }}</slot>
      </dd>
    </div>
  </dl>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true } // [{ key, label, value? }]
})
</script>
