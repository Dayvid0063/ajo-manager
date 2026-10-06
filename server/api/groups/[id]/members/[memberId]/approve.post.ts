// server/api/groups/[id]/members/[memberId]/approve.post.ts
import { memberParamsSchema } from '#shared/schemas/membership'
import { approveMember } from '../../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id, memberId } = validateParams(event, memberParamsSchema)
  return approveMember(id, user.id, memberId, event.context.requestId)
})
