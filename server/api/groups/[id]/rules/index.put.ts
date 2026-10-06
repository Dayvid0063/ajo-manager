// server/api/groups/[id]/rules/index.put.ts
import { groupIdParamsSchema, rulesSchema } from '#shared/schemas/group'
import { saveRules } from '../../../../services/groups'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const { rules } = await validateBody(event, rulesSchema)
  return { rules: await saveRules(id, user.id, rules, event.context.requestId) }
})
