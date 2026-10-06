// server/api/groups/[id]/cancel.post.ts
import { cancelGroupSchema, groupIdParamsSchema } from '#shared/schemas/group'
import { cancelGroup } from '../../../services/groups'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const { reason } = await validateBody(event, cancelGroupSchema)
  return { group: await cancelGroup(id, user.id, reason, event.context.requestId) }
})
