// server/api/obligations/[id]/index.get.ts
// One payment: amount, due date, who to pay (+ their bank details if authorized), claim history.
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { getObligationDetail } from '../../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return getObligationDetail(id, user.id)
})
