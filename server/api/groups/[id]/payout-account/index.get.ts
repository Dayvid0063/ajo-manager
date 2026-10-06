// server/api/groups/[id]/payout-account/index.get.ts
// The caller's own payout bank account for this group.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { getMyPayoutAccount } from '../../../../services/bank-accounts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return getMyPayoutAccount(id, user.id)
})
