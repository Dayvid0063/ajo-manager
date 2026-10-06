// server/api/admin/fees/[id]/evidence.get.ts
// Platform admin: short-lived link to a fee transfer screenshot.
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { feeEvidenceUrl } from '../../../../services/fees'

export default defineEventHandler(async (event) => {
  const admin = await requirePlatformAdmin(event)
  const { id } = validateParams(event, idParamsSchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return feeEvidenceUrl({ feeId: id }, admin, { storage: storage() })
})
