// server/api/admin/users/index.get.ts
// Platform admin: look up users by email or name.
import { userSearchSchema } from '#shared/schemas/auth'
import { searchUsers } from '../../../services/auth'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  const query = validateQuery(event, userSearchSchema)
  return searchUsers(query)
})
