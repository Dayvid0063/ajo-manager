// server/api/records/[id]/confirm.post.ts
// The recipient (if allowed) or an owner/admin confirms the money arrived.
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { reviewRecord } from '../../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  return reviewRecord(id, user.id, { action: 'confirm' }, event.context.requestId)
})
