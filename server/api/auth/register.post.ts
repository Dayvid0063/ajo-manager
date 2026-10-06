// server/api/auth/register.post.ts
import { registerSchema } from '#shared/schemas/auth'
import { registerUser, toSessionUser } from '../../services/auth'

export default defineEventHandler(async (event) => {
  assertWithinLimit(authLimiters.registerByIp, `register:${clientIp(event)}`)
  const input = await validateBody(event, registerSchema)

  const user = await registerUser({ email: input.email, password: input.password })
  await startSession(event, user)

  setResponseStatus(event, 201)
  return { user: toSessionUser(user) }
})
