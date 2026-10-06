// server/api/groups/[id]/activity.get.ts
// Group activity (audit entries) for the owner and admins.
import { paginationSchema } from '#shared/schemas/common'
import { groupIdParamsSchema } from '#shared/schemas/group'
import { groupActivity } from '../../../services/groups'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const query = validateQuery(event, paginationSchema)
  return groupActivity(id, user.id, query)
})
