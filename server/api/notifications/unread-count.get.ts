// server/api/notifications/unread-count.get.ts
import { unreadCount } from '../../services/notifications'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { count: await unreadCount(user.id) }
})
