// server/api/groups/[id]/index.patch.ts
// Owner edits settings. Contribution/payout settings are draft-only (the service enforces it).
import { groupIdParamsSchema, updateGroupSchema } from '#shared/schemas/group'
import { updateGroup } from '../../../services/groups'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  const input = await validateBody(event, updateGroupSchema)
  return { group: await updateGroup(id, user.id, input, event.context.requestId) }
})
