// server/utils/authz.ts
// Event-based guards used at the top of every protected route. The server is the
// only trust boundary: never rely on the UI hiding a button.
import type { H3Event } from 'h3'
import type { MemberRole } from '#shared/constants'
import { resolveSessionUser, toSessionUser } from '../services/auth'
import { forbidden, notFound } from './errors'
import { hasGroupRole, type MembershipLike } from './policy'

/**
 * Require a logged-in user, re-checked against the database (exists, active,
 * session not revoked, no pending forced password change).
 * Returns the fresh session-shaped user.
 */
export async function requireUser(event: H3Event, options: { allowPasswordChange?: boolean } = {}) {
  const session = await getUserSession(event)
  try {
    const user = await resolveSessionUser(session.user?.id, session.secure?.sessionVersion, options)
    return toSessionUser(user)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 401 && session.user) {
      await clearUserSession(event)
    }
    throw error
  }
}

/** Require a platform admin — checked against the database, not the cookie. */
export async function requirePlatformAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (!user.isPlatformAdmin) {
    throw forbidden()
  }
  return user
}

/**
 * Assert the caller's membership has one of the allowed roles.
 * Non-members get 404 (not 403) so group existence isn't leaked.
 */
export function assertGroupRole(membership: MembershipLike | null | undefined, allowed: readonly MemberRole[]) {
  if (!membership) {
    throw notFound()
  }
  if (!hasGroupRole(membership, allowed)) {
    throw forbidden()
  }
  return membership
}
