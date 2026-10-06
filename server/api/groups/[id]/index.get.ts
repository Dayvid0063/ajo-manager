// server/api/groups/[id]/index.get.ts
import { groupIdParamsSchema } from '#shared/schemas/group'
import { getGroupDetail } from '../../../services/groups'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return getGroupDetail(id, user.id)
})
