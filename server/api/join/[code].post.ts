// server/api/join/[code].post.ts
// Ask to join a group. The owner or an admin must approve.
import { joinCodeParamsSchema } from '#shared/schemas/membership'
import { requestToJoin } from '../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertWithinLimit(authLimiters.inviteLookupByIp, `invite:${clientIp(event)}`)
  const { code } = validateParams(event, joinCodeParamsSchema)
  return requestToJoin(code, user.id, event.context.requestId)
})
