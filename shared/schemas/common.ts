// shared/schemas/common.ts
// Reusable Zod building blocks shared by client forms and server routes.
import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')

export const koboSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})
