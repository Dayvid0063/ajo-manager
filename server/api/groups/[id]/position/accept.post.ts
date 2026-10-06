// server/api/groups/[id]/position/accept.post.ts
// The caller accepts the payout position they were given.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { acceptPosition } from '../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return acceptPosition(id, user.id, event.context.requestId)
})
