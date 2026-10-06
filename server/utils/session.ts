// server/utils/session.ts
// Writes the session cookie for a user (login, register, password/profile changes).
import type { H3Event } from 'h3'
import { toSecureSession, toSessionUser } from '../services/auth'

type SessionSource = Parameters<typeof toSessionUser>[0]

export async function startSession(event: H3Event, user: SessionSource) {
  await replaceUserSession(event, {
    user: toSessionUser(user),
    secure: toSecureSession(user),
    loggedInAt: Date.now()
  })
}

/** Refresh the cookie after the user's data changed, keeping the login time. */
export async function refreshSession(event: H3Event, user: SessionSource) {
  await setUserSession(event, {
    user: toSessionUser(user),
    secure: toSecureSession(user)
  })
}

export function clientIp(event: H3Event): string {
  // Railway sits behind a proxy, so trust X-Forwarded-For
  return getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
}
