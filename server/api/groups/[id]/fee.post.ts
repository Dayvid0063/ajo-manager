// server/api/groups/[id]/fee.post.ts
// Owner reports the ₦3,700 bank transfer made outside the app.
import { groupIdParamsSchema, reportFeeSchema } from '#shared/schemas/group'
import { reportFee } from '../../../services/fees'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const input = await validateBody(event, reportFeeSchema)
  return { fee: await reportFee(id, user.id, input, feeConfig(), event.context.requestId) }
})
