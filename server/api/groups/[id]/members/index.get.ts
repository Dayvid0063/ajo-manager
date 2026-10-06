// server/api/groups/[id]/members/index.get.ts
// Approved members (everyone) + pending requests and contact details (owner/admins only).
import { groupIdParamsSchema } from '#shared/schemas/group'
import { listMembers } from '../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return listMembers(id, user.id)
})
