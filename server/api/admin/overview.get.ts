// server/api/admin/overview.get.ts
import { adminOverview } from '../../services/admin'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  return adminOverview()
})
