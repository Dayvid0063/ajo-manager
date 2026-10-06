// tests/unit/password.test.ts
import { describe, expect, it } from 'vitest'
import { generateTemporaryPassword, hashUserPassword, verifyAgainstDummy, verifyUserPassword } from '../../server/utils/password'

describe('password hashing', () => {
  it('uses argon2id and verifies correctly', async () => {
    const hashed = await hashUserPassword('correct horse')
    expect(hashed.startsWith('$argon2id$')).toBe(true)
    expect(hashed).not.toContain('correct horse')
    expect(await verifyUserPassword(hashed, 'correct horse')).toBe(true)
    expect(await verifyUserPassword(hashed, 'wrong horse')).toBe(false)
  })

  it('treats a malformed hash as a failed check, not a crash', async () => {
    expect(await verifyUserPassword('not-a-hash', 'anything')).toBe(false)
  })

  it('dummy verification always fails', async () => {
    expect(await verifyAgainstDummy('dummy-password-for-timing-only')).toBe(false)
  })
})

describe('temporary passwords', () => {
  it('are 12 characters with no look-alike characters', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTemporaryPassword()
      expect(password).toHaveLength(12)
      expect(password).not.toMatch(/[0O1lI]/)
    }
  })

  it('are not repeated', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()))
    expect(set.size).toBe(200)
  })
})
