// server/api/uploads/evidence.post.ts
// Returns a 5-minute signed URL for the browser to upload proof straight to the
// private R2 bucket. The file is attached when the payment/fee is reported.
import { evidenceUploadSchema } from '#shared/schemas/payments'
import { createEvidenceUpload } from '../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await validateBody(event, evidenceUploadSchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return createEvidenceUpload(user.id, input, { storage: storage() })
})
