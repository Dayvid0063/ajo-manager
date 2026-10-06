// server/api/groups/[id]/activate.post.ts
// Owner starts the group: schedule is generated and tracking begins.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { activateGroupSchema } from '#shared/schemas/membership'
import { activateGroup } from '../../../services/activation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const input = await validateBody(event, activateGroupSchema)
  return activateGroup(id, user.id, input, event.context.requestId)
})
