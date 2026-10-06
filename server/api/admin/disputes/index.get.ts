// server/api/admin/disputes/index.get.ts
import { disputeListQuerySchema } from '#shared/schemas/disputes'
import { listAllDisputes } from '../../../services/disputes'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  return listAllDisputes(validateQuery(event, disputeListQuerySchema))
})
