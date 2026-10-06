// app/composables/useGroupDetail.js
// Access the group loaded by pages/groups/[id].vue from its child pages.

export function useGroupDetail() {
  const detail = inject('groupDetail', null)
  if (!detail) {
    throw new Error('useGroupDetail() must be used inside pages/groups/[id]')
  }
  const group = computed(() => detail.data.value?.group ?? null)
  const rules = computed(() => detail.data.value?.rules ?? null)
  const memberCount = computed(() => detail.data.value?.memberCount ?? 0)
  // The caller's own membership: role, position, what they still need to accept
  const me = computed(() => detail.data.value?.me ?? null)
  return { group, rules, memberCount, me, refresh: detail.refresh }
}
