// server/api/notifications/index.get.ts
import { paginationSchema } from '#shared/schemas/common'
import { listNotifications } from '../../services/notifications'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return listNotifications(user.id, validateQuery(event, paginationSchema))
})
