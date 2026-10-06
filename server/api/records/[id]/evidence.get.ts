// server/api/records/[id]/evidence.get.ts
// Short-lived signed link to a payment's proof — payer, recipient and owner/admins only.
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { recordEvidenceUrl } from '../../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return recordEvidenceUrl(id, user.id, { storage: storage() })
})
