// server/api/admin/fees/index.get.ts
// Platform admin: fee verification queue.
import { feeListQuerySchema } from '#shared/schemas/group'
import { listFees } from '../../../services/fees'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  return listFees(validateQuery(event, feeListQuerySchema))
})
