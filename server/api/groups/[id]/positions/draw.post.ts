// server/api/groups/[id]/positions/draw.post.ts
// Owner runs the random payout draw (method "random").
import { groupIdParamsSchema } from '#shared/schemas/group'
import { drawPositions } from '../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return drawPositions(id, user.id, event.context.requestId)
})
