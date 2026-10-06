// server/utils/authz.ts
// Event-based guards used at the top of every protected route. The server is the
// only trust boundary: never rely on the UI hiding a button.
//
// SKELETON (Phase 1): session guards are complete; group membership loading is
// added in Phase 3/4 once the group_members model exists.
import type { H3Event } from 'h3'
import type { MemberRole } from '#shared/constants'
import { forbidden, notFound, unauthorized } from './errors'
import { hasGroupRole, isPlatformAdmin, type MembershipLike } from './policy'

/** Require a logged-in user; returns the session user. */
export async function requireUser(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user) {
    throw unauthorized()
  }
  return session.user
}

/** Require a platform admin (e.g. management-fee verification). */
export async function requirePlatformAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (!isPlatformAdmin(user)) {
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
