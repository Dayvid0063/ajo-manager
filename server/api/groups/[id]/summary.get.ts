// server/api/groups/[id]/summary.get.ts
// Cycle summary: progress while running, final figures when completed.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { getCycleSummary } from '../../../services/cycle'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return getCycleSummary(id, user.id)
})
