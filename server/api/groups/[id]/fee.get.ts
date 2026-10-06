// server/api/groups/[id]/fee.get.ts
// Fee instructions (platform bank details, amount, reference) + current report.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { getGroupFee } from '../../../services/fees'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return getGroupFee(id, user.id, feeConfig())
})
