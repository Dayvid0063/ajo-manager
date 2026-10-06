// tests/server/auth.test.ts
// Account logic against a real (in-memory) MongoDB replica set.
import { describe, expect, it } from 'vitest'
import { User } from '../../server/models/user'
import { AuditLog } from '../../server/models/audit-log'
import {
  INVALID_LOGIN_MESSAGE,
  PASSWORD_CHANGE_REQUIRED,
  authenticate,
  changePassword,
  issueTemporaryPassword,
  registerUser,
  resolveSessionUser,
  searchUsers,
  updateProfile
} from '../../server/services/auth'
import { useTestDatabase } from '../helpers/mongo'

useTestDatabase()

let counter = 0
const uniqueEmail = () => `user${++counter}@ajo.test`

async function expectHttpError(promise: Promise<unknown>, statusCode: number, message?: string) {
  try {
    await promise
    expect.unreachable('expected an error')
  } catch (error) {
    const err = error as { statusCode: number, message: string, data?: unknown }
    expect(err.statusCode).toBe(statusCode)
    if (message) expect(err.message).toBe(message)
    return err
  }
}

describe('registration', () => {
  it('creates a user with a hashed password', async () => {
    const email = uniqueEmail()
    const user = await registerUser({ email, password: 'password-123' })
    const stored = await User.findById(user._id).select('+passwordHash').lean()
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/)
    expect(stored?.isPlatformAdmin).toBe(false)
  })

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail()
    await registerUser({ email, password: 'password-123' })
    await expectHttpError(registerUser({ email, password: 'password-456' }), 409)
  })

  it('the unique index stops simultaneous sign-ups with the same email', async () => {
    const email = uniqueEmail()
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => registerUser({ email, password: 'password-123' }))
    )
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await User.countDocuments({ email })).toBe(1)
  })
})

describe('login', () => {
  it('logs in with the right password', async () => {
    const email = uniqueEmail()
    await registerUser({ email, password: 'password-123' })
    const user = await authenticate({ email, password: 'password-123' })
    expect(user.email).toBe(email)
    expect(user.lastLoginAt).toBeInstanceOf(Date)
  })

  it('gives the same message for a wrong password and an unknown email', async () => {
    const email = uniqueEmail()
    await registerUser({ email, password: 'password-123' })
    await expectHttpError(authenticate({ email, password: 'wrong-password' }), 401, INVALID_LOGIN_MESSAGE)
    await expectHttpError(authenticate({ email: 'nobody@ajo.test', password: 'password-123' }), 401, INVALID_LOGIN_MESSAGE)
  })

  it('refuses disabled accounts with the same message', async () => {
    const email = uniqueEmail()
    const user = await registerUser({ email, password: 'password-123' })
    await User.updateOne({ _id: user._id }, { status: 'disabled' })
    await expectHttpError(authenticate({ email, password: 'password-123' }), 401, INVALID_LOGIN_MESSAGE)
  })
})

describe('session checks', () => {
  it('accepts a valid session', async () => {
    const user = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    const resolved = await resolveSessionUser(String(user._id), 0)
    expect(String(resolved._id)).toBe(String(user._id))
  })

  it('rejects missing, deleted, disabled and revoked sessions with 401', async () => {
    await expectHttpError(resolveSessionUser(undefined, 0), 401)
    await expectHttpError(resolveSessionUser('65f1c2a9b4e3d2a1f0e9d8c7', 0), 401)

    const disabled = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    await User.updateOne({ _id: disabled._id }, { status: 'disabled' })
    await expectHttpError(resolveSessionUser(String(disabled._id), 0), 401)

    const revoked = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    await User.updateOne({ _id: revoked._id }, { $inc: { sessionVersion: 1 } })
    await expectHttpError(resolveSessionUser(String(revoked._id), 0), 401)
  })

  it('blocks everything but password change while a temporary password is active', async () => {
    const user = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    await User.updateOne({ _id: user._id }, { mustChangePassword: true })
    const err = await expectHttpError(resolveSessionUser(String(user._id), 0), 403)
    expect(err.data).toEqual({ code: PASSWORD_CHANGE_REQUIRED })
    await expect(resolveSessionUser(String(user._id), 0, { allowPasswordChange: true })).resolves.toBeTruthy()
  })
})

describe('change password', () => {
  it('requires the correct current password', async () => {
    const user = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    await expectHttpError(changePassword(String(user._id), { currentPassword: 'nope', newPassword: 'new-password-1' }), 400)
  })

  it('changes the password, clears the forced flag and logs out other devices', async () => {
    const email = uniqueEmail()
    const user = await registerUser({ email, password: 'password-123' })
    await User.updateOne({ _id: user._id }, { mustChangePassword: true })

    const updated = await changePassword(String(user._id), { currentPassword: 'password-123', newPassword: 'new-password-1' })
    expect(updated.mustChangePassword).toBe(false)
    expect(updated.sessionVersion).toBe(1)

    await expectHttpError(authenticate({ email, password: 'password-123' }), 401)
    await expect(authenticate({ email, password: 'new-password-1' })).resolves.toBeTruthy()
  })
})

describe('profile', () => {
  it('saves name and phone and records when the profile was first completed', async () => {
    const user = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    const first = await updateProfile(String(user._id), { name: 'Ada Okafor', phone: '08031234567' })
    expect(first.name).toBe('Ada Okafor')
    const completedAt = first.profileCompletedAt

    const second = await updateProfile(String(user._id), { name: 'Adaeze Okafor', phone: '' })
    expect(second.name).toBe('Adaeze Okafor')
    expect(second.profileCompletedAt?.getTime()).toBe(completedAt?.getTime())
  })
})

describe('temporary password (platform-admin reset)', () => {
  it('replaces the password, forces a change, revokes sessions and writes an audit entry', async () => {
    const admin = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    const email = uniqueEmail()
    const target = await registerUser({ email, password: 'old-password-1' })

    const { temporaryPassword } = await issueTemporaryPassword({
      actorId: String(admin._id),
      targetUserId: String(target._id),
      correlationId: 'req-123'
    })

    const stored = await User.findById(target._id).lean()
    expect(stored?.mustChangePassword).toBe(true)
    expect(stored?.sessionVersion).toBe(1)

    // Old password no longer works; temporary one does
    await expectHttpError(authenticate({ email, password: 'old-password-1' }), 401)
    await expect(authenticate({ email, password: temporaryPassword })).resolves.toBeTruthy()

    // Existing sessions are revoked
    await expectHttpError(resolveSessionUser(String(target._id), 0, { allowPasswordChange: true }), 401)

    const audit = await AuditLog.findOne({ entityId: target._id, action: 'user.temporary_password_issued' }).lean()
    expect(String(audit?.actor)).toBe(String(admin._id))
    expect(audit?.correlationId).toBe('req-123')
    // The password must never be written to the audit log
    expect(JSON.stringify(audit)).not.toContain(temporaryPassword)
  })

  it('cannot be issued to yourself', async () => {
    const admin = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    await expectHttpError(issueTemporaryPassword({ actorId: String(admin._id), targetUserId: String(admin._id) }), 400)
  })

  it('writes nothing when the user does not exist', async () => {
    const admin = await registerUser({ email: uniqueEmail(), password: 'password-123' })
    const before = await AuditLog.countDocuments()
    await expectHttpError(
      issueTemporaryPassword({ actorId: String(admin._id), targetUserId: '65f1c2a9b4e3d2a1f0e9d8c7' }),
      404
    )
    expect(await AuditLog.countDocuments()).toBe(before)
  })
})

describe('audit log', () => {
  it('is append-only', async () => {
    const entry = await AuditLog.create({ action: 'test', entityType: 'test', entityId: '65f1c2a9b4e3d2a1f0e9d8c7' })
    await expect(AuditLog.updateOne({ _id: entry._id }, { action: 'changed' })).rejects.toThrow('append-only')
    await expect(AuditLog.deleteOne({ _id: entry._id })).rejects.toThrow('append-only')
  })
})

describe('user search', () => {
  it('finds by email or name, case-insensitively, and treats input as text not regex', async () => {
    const user = await registerUser({ email: 'searchable.person@ajo.test', password: 'password-123' })
    await updateProfile(String(user._id), { name: 'Searchable Person', phone: '' })

    expect((await searchUsers({ q: 'SEARCHABLE.PERSON', page: 1, limit: 20 })).items.map(i => i.email)).toContain('searchable.person@ajo.test')
    expect((await searchUsers({ q: 'searchable person', page: 1, limit: 20 })).total).toBe(1)
    expect((await searchUsers({ q: '.*', page: 1, limit: 20 })).total).toBe(0)
  })

  it('never returns password hashes', async () => {
    const result = await searchUsers({ q: '', page: 1, limit: 50 })
    expect(JSON.stringify(result)).not.toContain('argon2')
  })
})
