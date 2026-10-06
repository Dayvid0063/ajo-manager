// server/api/auth/change-password.post.ts
// Works while a temporary password is active (that's the point of it).
import { changePasswordSchema } from '#shared/schemas/auth'
import { changePassword, toSessionUser } from '../../services/auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event, { allowPasswordChange: true })
  const input = await validateBody(event, changePasswordSchema)

  const user = await changePassword(sessionUser.id, input)
  // Other devices are logged out (sessionVersion bumped); keep this one logged in
  await refreshSession(event, user)

  return { user: toSessionUser(user) }
})
