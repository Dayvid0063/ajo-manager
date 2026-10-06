// server/api/notifications/read.post.ts
// Mark the caller's notifications as read (all of them when no ids are given).
import { z } from 'zod'
import { objectIdSchema } from '#shared/schemas/common'
import { markRead } from '../../services/notifications'

const bodySchema = z.object({ ids: z.array(objectIdSchema).max(100).optional().default([]) })

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { ids } = await validateBody(event, bodySchema)
  return markRead(user.id, ids)
})
