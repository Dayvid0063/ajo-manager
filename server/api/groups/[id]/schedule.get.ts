// server/api/groups/[id]/schedule.get.ts
// Rounds: who collects, when, and how much.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { getSchedule } from '../../../services/activation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return getSchedule(id, user.id)
})
