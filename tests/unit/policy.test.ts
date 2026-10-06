// tests/unit/policy.test.ts
import { describe, expect, it } from 'vitest'
import { hasGroupRole, isApprovedMember, isGroupManager, isPlatformAdmin, ownsRecord } from '../../server/utils/policy'

const member = (role: string, status = 'approved') => ({ user: 'u1', role, status })

describe('group roles', () => {
  it('only approved memberships have rights', () => {
    expect(isApprovedMember(member('member'))).toBe(true)
    expect(isApprovedMember(member('owner', 'pending'))).toBe(false)
    expect(isApprovedMember(member('admin', 'removed'))).toBe(false)
    expect(isApprovedMember(null)).toBe(false)
  })

  it('owner and admin are managers; member is not', () => {
    expect(isGroupManager(member('owner'))).toBe(true)
    expect(isGroupManager(member('admin'))).toBe(true)
    expect(isGroupManager(member('member'))).toBe(false)
  })

  it('a pending owner has no manager rights', () => {
    expect(isGroupManager(member('owner', 'pending'))).toBe(false)
  })

  it('unknown roles are never allowed', () => {
    expect(hasGroupRole(member('superuser'), ['owner', 'admin', 'member'])).toBe(false)
  })
})

describe('platform admin', () => {
  it('requires an explicit true flag', () => {
    expect(isPlatformAdmin({ id: 'u1', isPlatformAdmin: true })).toBe(true)
    expect(isPlatformAdmin({ id: 'u1' })).toBe(false)
    expect(isPlatformAdmin(null)).toBe(false)
  })
})

describe('record ownership', () => {
  it('matches by user id, including ObjectId-like values', () => {
    const objectIdLike = { toString: () => 'u1' }
    expect(ownsRecord({ id: 'u1' }, 'u1')).toBe(true)
    expect(ownsRecord({ id: 'u1' }, objectIdLike)).toBe(true)
    expect(ownsRecord({ id: 'u1' }, 'u2')).toBe(false)
    expect(ownsRecord({ id: 'u1' }, null)).toBe(false)
  })
})
