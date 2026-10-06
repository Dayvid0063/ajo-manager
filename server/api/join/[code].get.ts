// server/api/join/[code].get.ts
// Limited group summary for anyone holding the invite code (login optional).
import { joinCodeParamsSchema } from '#shared/schemas/membership'
import { getJoinSummary } from '../../services/membership'

export default defineEventHandler(async (event) => {
  assertWithinLimit(authLimiters.inviteLookupByIp, `invite:${clientIp(event)}`)
  const { code } = validateParams(event, joinCodeParamsSchema)
  const session = await getUserSession(event)
  return getJoinSummary(code, session.user?.id ?? null)
})
