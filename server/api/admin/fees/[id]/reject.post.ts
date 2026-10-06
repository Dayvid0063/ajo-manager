// server/api/admin/fees/[id]/reject.post.ts
import { groupIdParamsSchema as idParamsSchema, rejectFeeSchema } from '#shared/schemas/group'
import { rejectFee } from '../../../../services/fees'

export default defineEventHandler(async (event) => {
  const admin = await requirePlatformAdmin(event)
  const { id } = validateParams(event, idParamsSchema)
  const { reason } = await validateBody(event, rejectFeeSchema)
  return rejectFee(id, admin.id, reason, event.context.requestId)
})
