// server/utils/policy.ts
// Pure authorization rules (no I/O) so they can be unit tested. The event-based
// guards in authz.ts load data and call these. See docs/permissions.md.
import type { MemberRole } from '#shared/constants'

export interface ActorLike {
  id: string
  isPlatformAdmin?: boolean
}

export interface MembershipLike {
  user?: unknown
  role: string
  status: string
}

/** An approved membership — pending/rejected/removed users have no group rights. */
export function isApprovedMember(membership: MembershipLike | null | undefined): membership is MembershipLike {
  return !!membership && membership.status === 'approved'
}

export function hasGroupRole(
  membership: MembershipLike | null | undefined,
  allowed: readonly MemberRole[]
): boolean {
  return isApprovedMember(membership) && (allowed as readonly string[]).includes(membership.role)
}

/** Owner or admin (admins also act as treasurer). */
export function isGroupManager(membership: MembershipLike | null | undefined): boolean {
  return hasGroupRole(membership, ['owner', 'admin'])
}

export function isPlatformAdmin(actor: ActorLike | null | undefined): boolean {
  return actor?.isPlatformAdmin === true
}

/** True when the actor is the user the record belongs to. */
export function ownsRecord(actor: ActorLike, ownerUserId: string | { toString(): string } | null | undefined): boolean {
  return !!ownerUserId && String(ownerUserId) === actor.id
}
