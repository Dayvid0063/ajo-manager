// server/api/admin/fees/[id]/confirm.post.ts
// Platform admin confirms the transfer arrived. Idempotent.
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { confirmFee } from '../../../../services/fees'

export default defineEventHandler(async (event) => {
  const admin = await requirePlatformAdmin(event)
  const { id } = validateParams(event, idParamsSchema)
  return confirmFee(id, admin.id, event.context.requestId)
})
