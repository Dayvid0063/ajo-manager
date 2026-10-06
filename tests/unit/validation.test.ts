// tests/unit/validation.test.ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseOrThrow } from '../../server/utils/validation'
import { emailSchema, koboSchema, objectIdSchema } from '#shared/schemas/common'

describe('parseOrThrow', () => {
  const schema = z.object({ email: emailSchema, amount: koboSchema })

  it('returns parsed data on success', () => {
    expect(parseOrThrow(schema, { email: ' Ada@Example.com ', amount: 2000000 })).toEqual({
      email: 'ada@example.com',
      amount: 2000000
    })
  })

  it('throws a 400 with field-level messages', () => {
    try {
      parseOrThrow(schema, { email: 'nope', amount: 10.5 })
      expect.unreachable()
    } catch (error) {
      const err = error as { statusCode: number, data: { fields: Record<string, string[]> } }
      expect(err.statusCode).toBe(400)
      expect(Object.keys(err.data.fields).sort()).toEqual(['amount', 'email'])
    }
  })
})

describe('common schemas', () => {
  it('validates ObjectIds', () => {
    expect(objectIdSchema.safeParse('65f1c2a9b4e3d2a1f0e9d8c7').success).toBe(true)
    expect(objectIdSchema.safeParse('not-an-id').success).toBe(false)
  })

  it('kobo must be a non-negative integer', () => {
    expect(koboSchema.safeParse(370000).success).toBe(true)
    expect(koboSchema.safeParse(3700.5).success).toBe(false)
    expect(koboSchema.safeParse(-1).success).toBe(false)
  })
})
