// server/api/obligations/[id]/mark-paid.post.ts
// The member reports a payment they made outside the app. A claim, not proof.
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { markPaidSchema } from '#shared/schemas/payments'
import { submitPayment } from '../../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  const input = await validateBody(event, markPaidSchema)
  setResponseStatus(event, 201)
  return { record: await submitPayment(id, user.id, input, { storage: storage() }, event.context.requestId) }
})
