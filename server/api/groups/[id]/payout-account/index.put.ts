// server/api/groups/[id]/payout-account/index.put.ts
import { groupIdParamsSchema } from '#shared/schemas/group'
import { bankAccountSchema } from '#shared/schemas/payments'
import { setMyPayoutAccount } from '../../../../services/bank-accounts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const input = await validateBody(event, bankAccountSchema)
  return setMyPayoutAccount(id, user.id, input, event.context.requestId)
})
