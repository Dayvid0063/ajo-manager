// server/api/admin/users/[id]/temporary-password.post.ts
// Platform admin issues a one-time password (v1 password reset — brief §16).
// The plain password is returned in this response only and is never stored.
import { z } from 'zod'
import { objectIdSchema } from '#shared/schemas/common'
import { issueTemporaryPassword } from '../../../../services/auth'

const paramsSchema = z.object({ id: objectIdSchema })

export default defineEventHandler(async (event) => {
  const admin = await requirePlatformAdmin(event)
  const { id } = validateParams(event, paramsSchema)

  setHeader(event, 'Cache-Control', 'no-store')
  return issueTemporaryPassword({
    actorId: admin.id,
    targetUserId: id,
    correlationId: event.context.requestId
  })
})
