// server/api/groups/[id]/members/[memberId]/role.put.ts
import { memberParamsSchema, setRoleSchema } from '#shared/schemas/membership'
import { setMemberRole } from '../../../../../services/membership'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id, memberId } = validateParams(event, memberParamsSchema)
  const { role } = await validateBody(event, setRoleSchema)
  return setMemberRole(id, user.id, memberId, role, event.context.requestId)
})
