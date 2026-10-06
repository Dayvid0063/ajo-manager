// server/api/groups/[id]/rules/accept.post.ts
// The caller accepts a specific rules version (must be the latest).
import { groupIdParamsSchema } from '#shared/schemas/group'
import { acceptRulesSchema } from '#shared/schemas/membership'
import { acceptRules } from '../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const { version } = await validateBody(event, acceptRulesSchema)
  return acceptRules(id, user.id, version, event.context.requestId)
})
