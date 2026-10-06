// server/api/admin/groups/[id].get.ts
// Read-only group detail for platform admins.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { adminGroupDetail } from '../../../services/admin'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return adminGroupDetail(id)
})
