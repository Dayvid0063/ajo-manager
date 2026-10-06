// server/api/groups/[id]/members/[memberId]/position.put.ts
// Owner/admin assigns a payout position (method "admin_assigns").
import { assignPositionSchema, memberParamsSchema } from '#shared/schemas/membership'
import { assignPosition } from '../../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id, memberId } = validateParams(event, memberParamsSchema)
  const { position } = await validateBody(event, assignPositionSchema)
  return assignPosition(id, user.id, memberId, position, event.context.requestId)
})
