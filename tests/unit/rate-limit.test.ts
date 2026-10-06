// tests/unit/rate-limit.test.ts
import { describe, expect, it } from 'vitest'
import { assertWithinLimit, RateLimiter } from '../../server/utils/rate-limit'

describe('RateLimiter', () => {
  it('allows up to the limit, then blocks', () => {
    const limiter = new RateLimiter(3, 60_000, () => 0)
    expect([limiter.hit('k'), limiter.hit('k'), limiter.hit('k'), limiter.hit('k')]).toEqual([true, true, true, false])
  })

  it('tracks keys separately', () => {
    const limiter = new RateLimiter(1, 60_000, () => 0)
    expect(limiter.hit('a')).toBe(true)
    expect(limiter.hit('b')).toBe(true)
    expect(limiter.hit('a')).toBe(false)
  })

  it('resets after the window', () => {
    let now = 0
    const limiter = new RateLimiter(1, 60_000, () => now)
    limiter.hit('k')
    expect(limiter.hit('k')).toBe(false)
    now = 60_000
    expect(limiter.hit('k')).toBe(true)
  })

  it('reset() clears a key', () => {
    const limiter = new RateLimiter(1, 60_000, () => 0)
    limiter.hit('k')
    limiter.reset('k')
    expect(limiter.hit('k')).toBe(true)
  })

  it('assertWithinLimit throws a 429 with a friendly message', () => {
    const limiter = new RateLimiter(0, 120_000, () => 0)
    try {
      assertWithinLimit(limiter, 'k')
      expect.unreachable()
    } catch (error) {
      const err = error as { statusCode: number, message: string }
      expect(err.statusCode).toBe(429)
      expect(err.message).toContain('2 minutes')
    }
  })
})
