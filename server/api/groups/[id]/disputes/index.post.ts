// server/api/groups/[id]/disputes/index.post.ts
import { openDisputeSchema } from '#shared/schemas/disputes'
import { groupIdParamsSchema } from '#shared/schemas/group'
import { openDispute } from '../../../../services/disputes'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertWithinLimit(authLimiters.disputesByUser, `dispute:${user.id}`)
  const { id } = validateParams(event, groupIdParamsSchema)
  const input = await validateBody(event, openDisputeSchema)
  setResponseStatus(event, 201)
  return openDispute(id, user.id, input, event.context.requestId)
})
