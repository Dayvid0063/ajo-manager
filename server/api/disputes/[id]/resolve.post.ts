// server/api/disputes/[id]/resolve.post.ts
// Owner/admins (not the person who raised it) or a platform admin record the outcome.
import { resolveDisputeSchema } from '#shared/schemas/disputes'
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { resolveDispute } from '../../../services/disputes'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  const input = await validateBody(event, resolveDisputeSchema)
  return resolveDispute(id, user, input, event.context.requestId)
})
