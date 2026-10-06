// server/utils/rate-limit.ts
// Basic fixed-window rate limiting for auth routes (brief §16).
// KNOWN LIMITATION: in-memory, so limits are per server instance and reset on
// restart. Fine for a single Railway instance; move to a shared store if scaled out.
import { createError } from 'h3'

interface Bucket {
  count: number
  resetAt: number
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private limit: number
  private windowMs: number
  private now: () => number

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
  }

  /** Count one hit. Returns false when the key is over its limit. */
  hit(key: string): boolean {
    const time = this.now()
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= time) {
      bucket = { count: 0, resetAt: time + this.windowMs }
      this.buckets.set(key, bucket)
    }
    bucket.count++
    if (this.buckets.size > 10_000) this.sweep(time)
    return bucket.count <= this.limit
  }

  reset(key: string) {
    this.buckets.delete(key)
  }

  retryAfterSeconds(key: string): number {
    const bucket = this.buckets.get(key)
    return bucket ? Math.max(1, Math.ceil((bucket.resetAt - this.now()) / 1000)) : 0
  }

  private sweep(time: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= time) this.buckets.delete(key)
    }
  }
}

export function assertWithinLimit(limiter: RateLimiter, key: string) {
  if (!limiter.hit(key)) {
    const minutes = Math.ceil(limiter.retryAfterSeconds(key) / 60)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`
    })
  }
}

const MINUTE = 60_000

export const authLimiters = {
  loginByIp: new RateLimiter(30, 15 * MINUTE),
  loginByEmail: new RateLimiter(8, 15 * MINUTE),
  registerByIp: new RateLimiter(10, 60 * MINUTE)
}
