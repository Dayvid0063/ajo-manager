// server/services/auth.ts
// Account logic, kept free of HTTP details so it can be tested directly.
// Route handlers in server/api/auth/* call these and manage the session cookie.
import type { Types } from 'mongoose'
import { User } from '../models/user'
import { conflict, forbidden, notFound, unauthorized, badRequest } from '../utils/errors'
import { generateTemporaryPassword, hashUserPassword, verifyAgainstDummy, verifyUserPassword } from '../utils/password'
import { withTransaction } from '../utils/db'
import { recordAudit } from './audit'

export const INVALID_LOGIN_MESSAGE = 'Email or password is incorrect.'
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED'

interface UserLike {
  _id: Types.ObjectId | string
  email?: string | null
  name?: string | null
  isPlatformAdmin?: boolean | null
  mustChangePassword?: boolean | null
  sessionVersion?: number | null
}

/** What goes into the session cookie (readable by the client — nothing sensitive). */
export function toSessionUser(user: UserLike) {
  return {
    id: String(user._id),
    email: user.email ?? '',
    name: user.name ?? '',
    isPlatformAdmin: user.isPlatformAdmin === true,
    mustChangePassword: user.mustChangePassword === true
  }
}

export function toSecureSession(user: UserLike) {
  return { sessionVersion: user.sessionVersion ?? 0 }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}

export async function registerUser(input: { email: string, password: string }) {
  const passwordHash = await hashUserPassword(input.password)
  try {
    return await User.create({
      email: input.email,
      passwordHash,
      passwordChangedAt: new Date()
    })
  } catch (error) {
    // The unique index is the real guard against two simultaneous sign-ups
    if (isDuplicateKeyError(error)) {
      throw conflict('An account with this email already exists. Try logging in instead.')
    }
    throw error
  }
}

export async function authenticate(input: { email: string, password: string }) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash')
  if (!user || !user.passwordHash) {
    await verifyAgainstDummy(input.password)
    throw unauthorized(INVALID_LOGIN_MESSAGE)
  }
  const valid = await verifyUserPassword(user.passwordHash, input.password)
  if (!valid || user.status !== 'active') {
    // Same message for a disabled account — don't reveal account state
    throw unauthorized(INVALID_LOGIN_MESSAGE)
  }
  user.lastLoginAt = new Date()
  await user.save()
  return user
}

/**
 * Check a session against the database on every protected request: the user
 * must still exist, be active, and the session must not have been revoked.
 */
export async function resolveSessionUser(
  sessionUserId: string | undefined,
  sessionVersion: number | undefined,
  options: { allowPasswordChange?: boolean } = {}
) {
  if (!sessionUserId) {
    throw unauthorized()
  }
  const user = await User.findById(sessionUserId).lean()
  if (!user || user.status !== 'active' || (user.sessionVersion ?? 0) !== (sessionVersion ?? 0)) {
    throw unauthorized('Your session has ended. Please log in again.')
  }
  if (user.mustChangePassword && !options.allowPasswordChange) {
    const error = forbidden('Please change your temporary password to continue.')
    error.data = { code: PASSWORD_CHANGE_REQUIRED }
    throw error
  }
  return user
}

export async function changePassword(userId: string, input: { currentPassword: string, newPassword: string }) {
  const user = await User.findById(userId).select('+passwordHash')
  if (!user || !user.passwordHash) {
    throw unauthorized()
  }
  if (!(await verifyUserPassword(user.passwordHash, input.currentPassword))) {
    throw badRequest('Your current password is incorrect.', { fields: { currentPassword: ['Your current password is incorrect.'] } })
  }
  user.passwordHash = await hashUserPassword(input.newPassword)
  user.mustChangePassword = false
  user.passwordChangedAt = new Date()
  // Log out every other device; the caller re-issues this device's session
  user.sessionVersion = (user.sessionVersion ?? 0) + 1
  await user.save()
  return user
}

export async function updateProfile(userId: string, input: { name: string, phone?: string }) {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: { name: input.name, phone: input.phone ?? '' },
      // Only set the first time the profile is completed
      $min: { profileCompletedAt: new Date() }
    },
    { returnDocument: 'after' }
  )
  if (!user) {
    throw notFound()
  }
  return user
}

/**
 * Platform-admin-assisted reset (brief §16): sets a one-time password the user
 * must change at next login, logs out all their sessions, and audits it —
 * in one transaction. Returns the plain temporary password exactly once.
 */
export async function issueTemporaryPassword(input: { actorId: string, targetUserId: string, correlationId?: string }) {
  if (input.actorId === input.targetUserId) {
    throw badRequest('Use "Change password" to change your own password.')
  }
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashUserPassword(temporaryPassword)

  await withTransaction(async (session) => {
    const user = await User.findById(input.targetUserId).session(session)
    if (!user) {
      throw notFound('User not found.')
    }
    const before = { mustChangePassword: user.mustChangePassword, sessionVersion: user.sessionVersion }
    user.passwordHash = passwordHash
    user.mustChangePassword = true
    user.passwordChangedAt = new Date()
    user.sessionVersion = (user.sessionVersion ?? 0) + 1
    await user.save({ session })

    await recordAudit(
      {
        actor: input.actorId,
        action: 'user.temporary_password_issued',
        entityType: 'user',
        entityId: user._id,
        // Never record the password or its hash
        before,
        after: { mustChangePassword: true, sessionVersion: user.sessionVersion },
        correlationId: input.correlationId
      },
      session
    )
  })

  return { temporaryPassword }
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function searchUsers(input: { q: string, page: number, limit: number }) {
  const filter = input.q
    ? { $or: [{ email: { $regex: escapeRegex(input.q), $options: 'i' } }, { name: { $regex: escapeRegex(input.q), $options: 'i' } }] }
    : {}
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .select('email name phone isPlatformAdmin mustChangePassword status createdAt lastLoginAt')
      .lean(),
    User.countDocuments(filter)
  ])
  return {
    items: items.map(user => ({
      id: String(user._id),
      email: user.email,
      name: user.name ?? '',
      phone: user.phone ?? '',
      isPlatformAdmin: user.isPlatformAdmin === true,
      mustChangePassword: user.mustChangePassword === true,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null
    })),
    total,
    page: input.page,
    limit: input.limit
  }
}
