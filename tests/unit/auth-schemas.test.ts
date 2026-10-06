// tests/unit/auth-schemas.test.ts
import { describe, expect, it } from 'vitest'
import { changePasswordSchema, loginSchema, profileSchema, registerSchema } from '#shared/schemas/auth'

describe('registerSchema', () => {
  it('normalises email and requires matching passwords', () => {
    const ok = registerSchema.safeParse({ email: ' Ada@Example.COM ', password: 'longenough', confirmPassword: 'longenough' })
    expect(ok.success && ok.data.email).toBe('ada@example.com')

    const mismatch = registerSchema.safeParse({ email: 'a@b.co', password: 'longenough', confirmPassword: 'different1' })
    expect(mismatch.success).toBe(false)
    expect(mismatch.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('rejects short passwords', () => {
    expect(registerSchema.safeParse({ email: 'a@b.co', password: 'short', confirmPassword: 'short' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('does not apply new-password rules (temporary/old passwords must work)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  it('requires a different new password', () => {
    const same = changePasswordSchema.safeParse({ currentPassword: 'samepass1', newPassword: 'samepass1', confirmPassword: 'samepass1' })
    expect(same.success).toBe(false)
  })
})

describe('profileSchema', () => {
  it('accepts Nigerian phone formats and empty phone', () => {
    for (const phone of ['08031234567', '0803 123 4567', '+234 803 123 4567', '']) {
      expect(profileSchema.safeParse({ name: 'Ada Okafor', phone }).success, phone).toBe(true)
    }
  })

  it('rejects junk phone numbers and too-short names', () => {
    expect(profileSchema.safeParse({ name: 'Ada', phone: 'call me' }).success).toBe(false)
    expect(profileSchema.safeParse({ name: 'A', phone: '' }).success).toBe(false)
  })
})
