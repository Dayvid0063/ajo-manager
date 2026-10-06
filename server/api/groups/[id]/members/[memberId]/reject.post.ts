// server/api/groups/[id]/members/[memberId]/reject.post.ts
import { decideMemberSchema, memberParamsSchema } from '#shared/schemas/membership'
import { rejectMember } from '../../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id, memberId } = validateParams(event, memberParamsSchema)
  const { reason } = await validateBody(event, decideMemberSchema)
  return rejectMember(id, user.id, memberId, reason, event.context.requestId)
})
