// server/api/disputes/[id]/messages.post.ts
import { disputeMessageSchema } from '#shared/schemas/disputes'
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { addDisputeMessage } from '../../../services/disputes'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  const { body } = await validateBody(event, disputeMessageSchema)
  return addDisputeMessage(id, user, body)
})
