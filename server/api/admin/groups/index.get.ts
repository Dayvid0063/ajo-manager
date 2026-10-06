// server/api/admin/groups/index.get.ts
import { adminGroupsQuerySchema } from '#shared/schemas/disputes'
import { adminListGroups } from '../../../services/admin'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  return adminListGroups(validateQuery(event, adminGroupsQuerySchema))
})
