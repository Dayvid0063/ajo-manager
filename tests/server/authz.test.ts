// tests/server/authz.test.ts
// Route guards with the session layer stubbed (nuxt-auth-utils' auto-imported
// getUserSession / clearUserSession) and a real database behind them.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { User } from '../../server/models/user'
import { registerUser } from '../../server/services/auth'
import { requirePlatformAdmin, requireUser } from '../../server/utils/authz'
import { useTestDatabase } from '../helpers/mongo'

useTestDatabase()

const event = {} as H3Event
const clearUserSession = vi.fn()

function stubSession(session: { user?: { id: string }, secure?: { sessionVersion: number } }) {
  vi.stubGlobal('getUserSession', vi.fn(async () => session))
  vi.stubGlobal('clearUserSession', clearUserSession)
}

beforeEach(() => {
  clearUserSession.mockClear()
})

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { statusCode: number }).statusCode
  }
}

describe('requireUser', () => {
  it('401 without a session', async () => {
    stubSession({})
    expect(await statusOf(requireUser(event))).toBe(401)
  })

  it('returns fresh data from the database, not the cookie', async () => {
    const user = await registerUser({ email: 'fresh@ajo.test', password: 'password-123' })
    await User.updateOne({ _id: user._id }, { name: 'Fresh Name' })
    stubSession({ user: { id: String(user._id) }, secure: { sessionVersion: 0 } })
    expect((await requireUser(event)).name).toBe('Fresh Name')
  })

  it('clears the cookie when the session was revoked', async () => {
    const user = await registerUser({ email: 'revoked@ajo.test', password: 'password-123' })
    await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } })
    stubSession({ user: { id: String(user._id) }, secure: { sessionVersion: 0 } })
    expect(await statusOf(requireUser(event))).toBe(401)
    expect(clearUserSession).toHaveBeenCalledOnce()
  })
})

describe('requirePlatformAdmin', () => {
  it('403 for a normal user', async () => {
    const user = await registerUser({ email: 'normal@ajo.test', password: 'password-123' })
    stubSession({ user: { id: String(user._id) }, secure: { sessionVersion: 0 } })
    expect(await statusOf(requirePlatformAdmin(event))).toBe(403)
  })

  it('allows a platform admin', async () => {
    const user = await registerUser({ email: 'admin@ajo.test', password: 'password-123' })
    await User.updateOne({ _id: user._id }, { isPlatformAdmin: true })
    stubSession({ user: { id: String(user._id) }, secure: { sessionVersion: 0 } })
    expect(await statusOf(requirePlatformAdmin(event))).toBe(200)
  })

  it('a stale cookie claiming admin is not enough — the database decides', async () => {
    const user = await registerUser({ email: 'pretender@ajo.test', password: 'password-123' })
    stubSession({ user: { id: String(user._id), isPlatformAdmin: true } as { id: string }, secure: { sessionVersion: 0 } })
    expect(await statusOf(requirePlatformAdmin(event))).toBe(403)
  })
})
