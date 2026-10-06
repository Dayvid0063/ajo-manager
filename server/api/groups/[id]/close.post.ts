// server/api/groups/[id]/close.post.ts
// Owner closes the cycle after the last due date, even with unconfirmed payments (kept on record).
import { closeCycleSchema } from '#shared/schemas/disputes'
import { groupIdParamsSchema } from '#shared/schemas/group'
import { closeCycle } from '../../../services/cycle'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const { reason } = await validateBody(event, closeCycleSchema)
  return closeCycle(id, user.id, reason, event.context.requestId)
})
