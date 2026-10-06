// server/api/groups/[id]/disputes/index.get.ts
// Owner/admins: every dispute in the group. Members: the ones they raised.
import { groupIdParamsSchema } from '#shared/schemas/group'
import { listGroupDisputes } from '../../../../services/disputes'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = validateParams(event, groupIdParamsSchema)
  return listGroupDisputes(id, user.id)
})
