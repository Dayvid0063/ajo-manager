// server/api/groups/index.post.ts
// Create a draft group. The creator becomes its owner.
import { createGroupSchema } from '#shared/schemas/group'
import { createGroup } from '../../services/groups'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await validateBody(event, createGroupSchema)
  const group = await createGroup(user.id, input, event.context.requestId)
  setResponseStatus(event, 201)
  return { group }
})
