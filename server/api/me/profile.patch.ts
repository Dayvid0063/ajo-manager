// server/api/me/profile.patch.ts
import { profileSchema } from '#shared/schemas/auth'
import { toSessionUser, updateProfile } from '../../services/auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const input = await validateBody(event, profileSchema)

  const user = await updateProfile(sessionUser.id, input)
  await refreshSession(event, user)

  return { user: toSessionUser(user), phone: user.phone ?? '' }
})
