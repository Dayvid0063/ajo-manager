// server/api/admin/audit.get.ts
// Read-only audit log. There is no route that edits or deletes entries.
import { auditQuerySchema } from '#shared/schemas/disputes'
import { adminAuditLog } from '../../services/admin'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  return adminAuditLog(validateQuery(event, auditQuerySchema))
})
