// server/api/auth/logout.post.ts
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
