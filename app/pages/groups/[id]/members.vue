<!-- app/pages/groups/[id]/members.vue -->
<!-- Members, join requests, roles and payout positions. -->
<template>
  <div v-if="group && data" class="flex flex-col gap-5">
    <AppAlert v-if="message" :tone="message.tone">{{ message.text }}</AppAlert>

    <!-- members_pick: choose your own slot -->
    <AppCard v-if="canPick" class="flex flex-col gap-3">
      <div>
        <h2 class="font-bold">Choose your payout position</h2>
        <p class="text-sm text-text-muted">Position 1 collects first. Once you pick, it's yours and locked in.</p>
      </div>
      <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
        <button
          v-for="slot in slots"
          :key="slot.position"
          type="button"
          :disabled="slot.taken || busy"
          class="flex min-h-14 flex-col items-center justify-center rounded-xl border text-sm font-bold disabled:cursor-not-allowed"
          :class="slot.taken ? 'border-border bg-surface-muted text-text-muted' : 'border-primary/40 bg-primary-soft text-primary hover:bg-primary hover:text-on-primary'"
          :aria-label="slot.taken ? `Position ${slot.position}, taken` : `Pick position ${slot.position}, around ${formatLagosDate(slot.date, 'medium')}`"
          @click="pick(slot.position)"
        >
          <span class="text-lg">{{ slot.position }}</span>
          <span class="text-[11px] font-semibold">{{ slot.taken ? 'Taken' : shortDate(slot.date) }}</span>
        </button>
      </div>
    </AppCard>

    <!-- random: owner runs the draw -->
    <AppCard v-if="canDraw" class="flex flex-col gap-3">
      <div>
        <h2 class="font-bold">Random payout draw</h2>
        <p class="text-sm text-text-muted">
          {{ allJoined ? 'Everyone has joined. Run the draw to give each member a position at random.' : canStartDraw ? `${data.members.length} of ${data.plannedMemberCount} have joined. You can draw now, or wait — you can draw again after more people join, until someone accepts their position.` : 'Available once at least 2 members have joined.' }}
        </p>
      </div>
      <AppButton icon="i-lucide-shuffle" class="self-start" :disabled="!canStartDraw" :loading="busy === 'draw'" @click="draw">
        {{ hasPositions ? 'Draw again' : 'Run the draw' }}
      </AppButton>
    </AppCard>

    <!-- Join requests -->
    <AppCard v-if="data.pending.length" class="flex flex-col gap-3">
      <h2 class="font-bold">Join requests ({{ data.pending.length }})</h2>
      <ul class="divide-y divide-border">
        <li v-for="request in data.pending" :key="request.memberId" class="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ request.name }}</p>
            <p class="truncate text-sm text-text-muted">{{ request.email }}<template v-if="request.phone"> · {{ request.phone }}</template></p>
          </div>
          <div class="flex gap-2">
            <AppButton variant="secondary" :loading="busy === `reject-${request.memberId}`" @click="decide(request, 'reject')">Decline</AppButton>
            <AppButton icon="i-lucide-check" :disabled="allJoined" :loading="busy === `approve-${request.memberId}`" @click="decide(request, 'approve')">Approve</AppButton>
          </div>
        </li>
      </ul>
      <p v-if="allJoined" class="text-sm text-text-muted">The group is full, so no more requests can be approved.</p>
    </AppCard>

    <!-- Members -->
    <AppCard class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-bold">Members</h2>
        <span class="tabular text-sm font-semibold text-text-muted">{{ data.members.length }} / {{ data.plannedMemberCount }}</span>
      </div>
      <ul class="divide-y divide-border">
        <li v-for="member in data.members" :key="member.memberId" class="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0">
          <div class="flex items-start gap-3">
            <span
              class="tabular inline-flex size-10 shrink-0 items-center justify-center rounded-xl font-extrabold"
              :class="member.position ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-text-muted'"
              :aria-label="member.position ? `Position ${member.position}` : 'No position yet'"
            >
              {{ member.position ?? '–' }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-2 font-semibold">
                {{ member.name }}<span v-if="member.isMe" class="text-text-muted">(you)</span>
                <span v-if="member.role !== 'member'" class="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">{{ ROLE_LABELS[member.role] }}</span>
              </p>
              <p v-if="member.email" class="truncate text-sm text-text-muted">{{ member.email }}<template v-if="member.phone"> · {{ member.phone }}</template></p>
              <p v-if="gathering" class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span :class="member.rulesAccepted ? 'text-status-confirmed' : 'text-text-muted'">
                  <Icon :name="member.rulesAccepted ? 'i-lucide-check' : 'i-lucide-minus'" class="inline size-4 align-text-bottom" aria-hidden="true" />
                  Rules {{ member.rulesAccepted ? 'accepted' : 'not accepted yet' }}
                </span>
                <span v-if="member.position" :class="member.positionAccepted ? 'text-status-confirmed' : 'text-text-muted'">
                  <Icon :name="member.positionAccepted ? 'i-lucide-check' : 'i-lucide-minus'" class="inline size-4 align-text-bottom" aria-hidden="true" />
                  Position {{ member.positionAccepted ? 'accepted' : 'not accepted yet' }}
                </span>
              </p>
            </div>
          </div>

          <!-- Manager controls -->
          <div v-if="gathering && (canAssign || (group.isOwner && member.role !== 'owner'))" class="flex flex-wrap items-center gap-2 pl-[52px]">
            <label v-if="canAssign" class="flex items-center gap-2 text-sm font-semibold">
              Position
              <select
                class="min-h-10 rounded-lg border border-border bg-surface px-2 font-semibold"
                :value="member.position ?? ''"
                :disabled="!!busy"
                @change="assign(member, $event.target.value)"
              >
                <option value="">None</option>
                <option v-for="p in data.plannedMemberCount" :key="p" :value="p" :disabled="takenBy(p, member)">
                  {{ p }}{{ takenBy(p, member) ? ' (taken)' : '' }}
                </option>
              </select>
            </label>
            <template v-if="group.isOwner && member.role !== 'owner'">
              <AppButton variant="ghost" :loading="busy === `role-${member.memberId}`" @click="toggleAdmin(member)">
                {{ member.role === 'admin' ? 'Remove admin' : 'Make admin' }}
              </AppButton>
              <AppButton variant="ghost" class="!text-status-rejected" :loading="busy === `remove-${member.memberId}`" @click="remove(member)">Remove</AppButton>
            </template>
          </div>
          <div v-else-if="group.status === 'active' && group.isOwner && member.role !== 'owner'" class="pl-[52px]">
            <AppButton variant="ghost" :loading="busy === `role-${member.memberId}`" @click="toggleAdmin(member)">
              {{ member.role === 'admin' ? 'Remove admin' : 'Make admin' }}
            </AppButton>
          </div>
        </li>
      </ul>
    </AppCard>
  </div>
</template>

<script setup>
import { ROLE_LABELS } from '~/utils/labels'

const route = useRoute()
const { group, me, refresh: refreshGroup } = useGroupDetail()
const { data, refresh } = await useFetch(() => `/api/groups/${route.params.id}/members`)

const gathering = computed(() => group.value?.status === 'awaiting_members')
const allJoined = computed(() => data.value && data.value.members.length >= data.value.plannedMemberCount)
const canStartDraw = computed(() => (data.value?.members.length ?? 0) >= 2)
const hasPositions = computed(() => data.value?.members.some(m => m.position))
const canAssign = computed(() => gathering.value && group.value?.canManage && data.value?.positionMethod === 'admin_assigns')
const canDraw = computed(() => gathering.value && group.value?.isOwner && data.value?.positionMethod === 'random' && !data.value?.members.some(m => m.positionAccepted))
const canPick = computed(() => gathering.value && data.value?.positionMethod === 'members_pick' && me.value && !me.value.positionAccepted)

const slots = computed(() => {
  if (!data.value || !group.value) return []
  const open = new Set(data.value.openPositions)
  return Array.from({ length: data.value.plannedMemberCount }, (_, i) => ({
    position: i + 1,
    taken: !open.has(i + 1),
    date: addPeriods(group.value.startDate, group.value.frequency, i)
  }))
})

function shortDate(ymd) {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }).format(lagosYmdToDate(ymd))
}

function takenBy(position, member) {
  return data.value.members.some(m => m.position === position && m.memberId !== member.memberId)
}

const busy = ref('')
const message = ref(null)

async function run(key, url, options, success) {
  busy.value = key
  message.value = null
  try {
    await $fetch(url, options)
    message.value = success ? { tone: 'success', text: success } : null
    await Promise.all([refresh(), refreshGroup()])
  } catch (error) {
    message.value = { tone: 'error', text: error?.data?.message || 'Something went wrong. Please try again.' }
    await refresh()
  } finally {
    busy.value = ''
  }
}

const base = computed(() => `/api/groups/${route.params.id}`)

function decide(request, action) {
  let body = {}
  if (action === 'reject') {
    const reason = window.prompt(`Decline ${request.name}'s request? You can add a short reason (optional):`, '')
    if (reason === null) return
    body = { reason }
  }
  return run(`${action}-${request.memberId}`, `${base.value}/members/${request.memberId}/${action}`, { method: 'POST', body },
    action === 'approve' ? `${request.name} is now a member.` : 'Request declined.')
}

function assign(member, value) {
  const position = value === '' ? null : Number(value)
  return run(`assign-${member.memberId}`, `${base.value}/members/${member.memberId}/position`, { method: 'PUT', body: { position } },
    position ? `${member.name} is now number ${position}.` : `Position cleared for ${member.name}.`)
}

function toggleAdmin(member) {
  const role = member.role === 'admin' ? 'member' : 'admin'
  return run(`role-${member.memberId}`, `${base.value}/members/${member.memberId}/role`, { method: 'PUT', body: { role } },
    role === 'admin' ? `${member.name} is now an admin.` : `${member.name} is no longer an admin.`)
}

function remove(member) {
  const reason = window.prompt(`Remove ${member.name} from the group? Add a short reason (optional):`, '')
  if (reason === null) return
  return run(`remove-${member.memberId}`, `${base.value}/members/${member.memberId}/remove`, { method: 'POST', body: { reason } }, `${member.name} was removed.`)
}

function pick(position) {
  if (!window.confirm(`Take position ${position}? You can't change it afterwards.`)) return
  return run('pick', `${base.value}/position/pick`, { method: 'POST', body: { position } }, `You are number ${position}.`)
}

function draw() {
  if (!window.confirm('Run the random draw now? Every member will get a position at random.')) return
  return run('draw', `${base.value}/positions/draw`, { method: 'POST' }, 'Done! Everyone has been told their position.')
}
</script>
