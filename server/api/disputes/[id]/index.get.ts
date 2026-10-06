// server/api/disputes/[id]/index.get.ts
// The person who raised it, the group's owner/admins, or a platform admin.
import { groupIdParamsSchema as idParamsSchema } from '#shared/schemas/group'
import { getDispute } from '../../../services/disputes'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, idParamsSchema)
  return getDispute(id, user)
})
