<!-- app/components/payment/EvidenceUpload.vue -->
<!-- Optional proof (screenshot/PDF). Uploads straight to the private bucket with a
     short-lived signed URL, then gives the parent the file key to submit. -->
<template>
  <div class="flex flex-col gap-1.5">
    <p class="text-sm font-semibold">{{ label }} <span class="font-normal text-text-muted">(optional)</span></p>

    <div v-if="fileName" class="flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-3.5 py-3">
      <Icon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-paperclip'" class="size-5 shrink-0 text-text-muted" :class="uploading && 'animate-spin'" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ fileName }}</span>
      <span v-if="uploading" class="text-sm text-text-muted">Uploading…</span>
      <AppButton v-else variant="ghost" @click="clear">Remove</AppButton>
    </div>

    <label
      v-else
      class="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 text-sm font-semibold text-text-muted hover:border-primary/50 hover:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
    >
      <Icon name="i-lucide-image-up" class="size-5" aria-hidden="true" />
      Add a screenshot or PDF of the transfer
      <input type="file" class="sr-only" :accept="EVIDENCE_TYPES.join(',')" @change="onFile">
    </label>

    <p v-if="error" class="flex items-center gap-1.5 text-sm font-medium text-status-rejected">
      <Icon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
    <p v-else class="text-sm text-text-muted">JPG, PNG, WebP or PDF, up to 5 MB. Only the payer, the recipient and group admins can see it.</p>
  </div>
</template>

<script setup>
import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES } from '#shared/schemas/payments'

const props = defineProps({
  purpose: { type: String, required: true }, // 'contribution' | 'fee'
  targetId: { type: String, required: true },
  label: { type: String, default: 'Proof of payment' }
})
const key = defineModel({ type: String, default: '' })
const emit = defineEmits(['uploading'])

const fileName = ref('')
const uploading = ref(false)
const error = ref('')

function clear() {
  key.value = ''
  fileName.value = ''
  error.value = ''
}

async function onFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  error.value = ''
  if (!EVIDENCE_TYPES.includes(file.type)) {
    error.value = 'Please choose a photo (JPG, PNG, WebP) or a PDF.'
    return
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    error.value = 'That file is too large. The limit is 5 MB.'
    return
  }

  fileName.value = file.name
  uploading.value = true
  emit('uploading', true)
  try {
    const upload = await $fetch('/api/uploads/evidence', {
      method: 'POST',
      body: { purpose: props.purpose, targetId: props.targetId, contentType: file.type, size: file.size }
    })
    const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body: file })
    if (!response.ok) throw new Error('upload failed')
    key.value = upload.key
  } catch (err) {
    fileName.value = ''
    key.value = ''
    error.value = err?.data?.message || 'The upload did not work. You can still submit with the bank reference.'
  } finally {
    uploading.value = false
    emit('uploading', false)
  }
}
</script>
