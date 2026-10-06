// server/api/records/[id]/reject.post.ts
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { rejectRecordSchema } from '#shared/schemas/payments'
import { reviewRecord } from '../../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  const { reason } = await validateBody(event, rejectRecordSchema)
  return reviewRecord(id, user.id, { action: 'reject', reason }, event.context.requestId)
})
