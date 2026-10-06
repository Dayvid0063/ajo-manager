// server/api/groups/[id]/readiness.get.ts
// Is the group ready to start? Computed on every request, never stored.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { getReadiness } from '../../../services/activation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return getReadiness(id, user.id)
})
