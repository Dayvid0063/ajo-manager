// server/api/groups/[id]/fee/evidence.get.ts
// Short-lived link to the fee transfer screenshot (group owner/admins).
import { groupIdParamsSchema } from '#shared/schemas/group'
import { feeEvidenceUrl } from '../../../../services/fees'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return feeEvidenceUrl({ groupId: id }, user, { storage: storage() })
})
