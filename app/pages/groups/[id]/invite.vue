<!-- app/pages/groups/[id]/invite.vue -->
<!-- Share the invite code, link or QR code. Joining still needs approval. -->
<template>
  <div v-if="group" class="flex flex-col gap-5">
    <AppAlert v-if="!group.inviteCode" tone="info">Invites are not open for this group.</AppAlert>

    <template v-else>
      <AppCard class="flex flex-col items-center gap-4 text-center">
        <p class="text-sm font-semibold text-text-muted">Invite code</p>
        <p class="tabular text-4xl font-extrabold tracking-[0.3em] text-primary">{{ group.inviteCode }}</p>
        <!-- QR is generated locally from our own link; the SVG is trusted output of the qrcode library -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="qrSvg" class="w-52 rounded-2xl bg-white p-3" role="img" :aria-label="`QR code for ${inviteLink}`" v-html="qrSvg" />
        <p class="max-w-sm text-sm text-text-muted">People can scan this, open the link, or enter the code at <strong>Join a group</strong>. You approve every request.</p>
      </AppCard>

      <AppCard class="flex flex-col gap-3">
        <h2 class="font-bold">Invite link</h2>
        <p class="tabular break-all rounded-xl bg-surface-muted px-3.5 py-3 text-sm">{{ inviteLink }}</p>
        <div class="flex flex-wrap gap-2">
          <AppButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy">{{ copied ? 'Copied' : 'Copy link' }}</AppButton>
          <AppButton v-if="canShare" variant="secondary" icon="i-lucide-share-2" @click="share">Share</AppButton>
        </div>
      </AppCard>

      <AppCard class="flex items-center justify-between gap-3">
        <p class="text-text-muted">{{ memberCount }} of {{ group.plannedMemberCount }} members have joined.</p>
        <AppButton :to="`/groups/${group.id}/members`" variant="ghost">See requests</AppButton>
      </AppCard>
    </template>
  </div>
</template>

<script setup>
import QRCode from 'qrcode'

const { group, memberCount } = useGroupDetail()
const config = useRuntimeConfig()

const inviteLink = computed(() => (group.value?.inviteCode ? `${config.public.appUrl}/join/${group.value.inviteCode}` : ''))

const qrSvg = ref('')
watch(
  inviteLink,
  async (link) => {
    qrSvg.value = link ? await QRCode.toString(link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1e1f1c', light: '#ffffff' } }) : ''
  },
  { immediate: true }
)

const canShare = ref(false)
onMounted(() => {
  canShare.value = typeof navigator !== 'undefined' && !!navigator.share
})

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}

async function share() {
  try {
    await navigator.share({
      title: `Join ${group.value.name}`,
      text: `Join our Ajo group "${group.value.name}" on Ajo Manager. Code: ${group.value.inviteCode}`,
      url: inviteLink.value
    })
  } catch {
    // Share sheet closed — nothing to do
  }
}
</script>
