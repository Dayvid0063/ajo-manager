// shared/schemas/payments.ts
// Mark-as-paid, review, payout bank account and evidence upload schemas.
import { z } from 'zod'
import { PAYMENT_METHOD } from '../constants'
import { isValidYmd, lagosToday } from '../utils/dates'
import { koboSchema, objectIdSchema } from './common'

export const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export const evidenceKeySchema = z.string().max(300).regex(/^evidence\/[a-z]+\/[a-f\d]{24}\/[\w-]+\.(jpg|png|webp|pdf)$/, 'Invalid upload')

export const markPaidSchema = z.object({
  amount: koboSchema.min(1, 'Enter the amount you paid'),
  paymentDate: z
    .string()
    .refine(isValidYmd, 'Choose a valid date')
    .refine(value => value <= lagosToday(), 'The payment date cannot be in the future'),
  method: z.enum(PAYMENT_METHOD, { message: 'Choose how you paid' }),
  reference: z.string().trim().max(100).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  evidenceKey: evidenceKeySchema.optional()
})

export const rejectRecordSchema = z.object({
  reason: z.string().trim().min(5, 'Explain what is wrong so the member can fix it').max(500)
})

export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2, 'Enter your bank').max(60),
  // NUBAN account numbers are 10 digits
  accountNumber: z.string().trim().regex(/^\d{10}$/, 'Enter the 10-digit account number'),
  accountName: z.string().trim().min(2, 'Enter the name on the account').max(100)
})

export const evidenceUploadSchema = z.object({
  purpose: z.enum(['contribution', 'fee']),
  targetId: objectIdSchema, // obligation id (contribution) or group id (fee)
  contentType: z.enum(EVIDENCE_TYPES, { message: 'Upload a photo (JPG, PNG, WebP) or a PDF' }),
  size: z.number().int().min(1).max(EVIDENCE_MAX_BYTES, 'The file is too large (max 5 MB)')
})

export const obligationListQuerySchema = z.object({
  filter: z.enum(['open', 'all']).default('open'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})
