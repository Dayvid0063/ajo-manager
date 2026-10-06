// server/api/me/obligations/index.get.ts
// Every payment the caller owes (open) or has owed (all), across groups.
import { obligationListQuerySchema } from '#shared/schemas/payments'
import { listMyObligations } from '../../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return listMyObligations(user.id, validateQuery(event, obligationListQuerySchema))
})
