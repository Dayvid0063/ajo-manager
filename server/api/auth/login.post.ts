// server/api/auth/login.post.ts
import { loginSchema } from '#shared/schemas/auth'
import { authenticate, toSessionUser } from '../../services/auth'

export default defineEventHandler(async (event) => {
  assertWithinLimit(authLimiters.loginByIp, `login-ip:${clientIp(event)}`)
  const input = await validateBody(event, loginSchema)
  const emailKey = `login-email:${input.email}`
  assertWithinLimit(authLimiters.loginByEmail, emailKey)

  const user = await authenticate(input)
  authLimiters.loginByEmail.reset(emailKey)
  await startSession(event, user)

  return { user: toSessionUser(user) }
})
