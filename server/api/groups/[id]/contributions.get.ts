// server/api/groups/[id]/contributions.get.ts
// The group's payment board: each round, who has paid, and claims to review.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { groupContributions } from '../../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return groupContributions(id, user.id)
})
