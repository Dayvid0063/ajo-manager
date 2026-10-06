// server/api/groups/[id]/members/[memberId]/remove.post.ts
import { decideMemberSchema, memberParamsSchema } from '#shared/schemas/membership'
import { removeMember } from '../../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id, memberId } = validateParams(event, memberParamsSchema)
  const { reason } = await validateBody(event, decideMemberSchema)
  return removeMember(id, user.id, memberId, reason, event.context.requestId)
})
