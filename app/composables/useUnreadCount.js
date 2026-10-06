// app/composables/useUnreadCount.js
// Unread alerts count for the nav badge. Shared state, refreshed on navigation.

export function useUnreadCount() {
  const count = useState('unread-count', () => 0)

  async function refresh() {
    try {
      const result = await $fetch('/api/notifications/unread-count')
      count.value = result.count
    } catch {
      // Not logged in or offline — keep the last value
    }
  }

  return { count, refresh }
}
