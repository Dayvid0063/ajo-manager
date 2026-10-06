// tests/unit/money.test.ts
import { describe, expect, it } from 'vitest'
import { formatKobo, isValidKobo, nairaToKobo } from '#shared/utils/money'

describe('formatKobo', () => {
  it('formats whole naira without kobo', () => {
    expect(formatKobo(370000)).toBe('₦3,700')
    expect(formatKobo(2000000)).toBe('₦20,000')
    expect(formatKobo(0)).toBe('₦0')
  })

  it('shows kobo only when non-zero', () => {
    expect(formatKobo(2000050)).toBe('₦20,000.50')
    expect(formatKobo(5)).toBe('₦0.05')
  })

  it('rejects floats and negatives', () => {
    expect(() => formatKobo(10.5)).toThrow()
    expect(() => formatKobo(-100)).toThrow()
  })
})

describe('nairaToKobo', () => {
  it('converts typed naira amounts to integer kobo', () => {
    expect(nairaToKobo(3700)).toBe(370000)
    expect(nairaToKobo('20,000')).toBe(2000000)
    expect(nairaToKobo('₦20,000.5')).toBe(2000050)
    expect(nairaToKobo('0.07')).toBe(7)
  })

  it('avoids floating point drift', () => {
    // 0.1 + 0.2 style errors must never appear in money
    expect(nairaToKobo('1234567.89')).toBe(123456789)
  })

  it('rejects invalid input', () => {
    expect(() => nairaToKobo('abc')).toThrow()
    expect(() => nairaToKobo('-5')).toThrow()
    expect(() => nairaToKobo('1.234')).toThrow()
  })
})

describe('isValidKobo', () => {
  it('accepts only non-negative safe integers', () => {
    expect(isValidKobo(100)).toBe(true)
    expect(isValidKobo(1.5)).toBe(false)
    expect(isValidKobo(-1)).toBe(false)
    expect(isValidKobo('100')).toBe(false)
  })
})
