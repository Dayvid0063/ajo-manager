// server/api/groups/[id]/position/pick.post.ts
// The caller picks an open payout slot (method "members_pick").
import { groupIdParamsSchema } from '#shared/schemas/group'
import { pickPositionSchema } from '#shared/schemas/membership'
import { pickPosition } from '../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const { position } = await validateBody(event, pickPositionSchema)
  return pickPosition(id, user.id, position, event.context.requestId)
})
