// server/middleware/request-id.ts
// Gives every request a correlation id (used in audit logs and error reports).
import { randomUUID } from 'node:crypto'

export default defineEventHandler((event) => {
  const incoming = getHeader(event, 'x-request-id')
  const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID()
  event.context.requestId = requestId
  setHeader(event, 'x-request-id', requestId)
})
