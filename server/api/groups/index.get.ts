// server/api/groups/index.get.ts
// Groups the current user belongs to.
import { listMyGroups } from '../../services/groups'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return listMyGroups(user.id)
})
