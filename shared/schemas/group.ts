// shared/schemas/group.ts
// Group creation / settings / fee schemas, shared by the wizard and the API.
import { z } from 'zod'
import { FREQUENCY, POSITION_METHOD } from '../constants'
import { isValidYmd, lagosToday } from '../utils/dates'
import { koboSchema, objectIdSchema } from './common'

export const GROUP_LIMITS = {
  minMembers: 2,
  maxMembers: 50,
  minAmountKobo: 100_00, // ₦100
  maxAmountKobo: 100_000_000_00 // ₦100,000,000
} as const

export const groupInfoSchema = z.object({
  name: z.string().trim().min(3, 'Use at least 3 characters').max(60, 'Use at most 60 characters'),
  description: z.string().trim().max(500, 'Use at most 500 characters').optional().default('')
})

const futureDateSchema = z
  .string()
  .refine(isValidYmd, 'Choose a valid date')
  .refine(value => value >= lagosToday(), 'Choose today or a later date')

export const contributionSettingsSchema = z.object({
  contributionAmount: koboSchema
    .min(GROUP_LIMITS.minAmountKobo, 'The minimum contribution is ₦100')
    .max(GROUP_LIMITS.maxAmountKobo, 'That amount is too large'),
  frequency: z.enum(FREQUENCY, { message: 'Choose weekly or monthly' }),
  startDate: futureDateSchema,
  plannedMemberCount: z.coerce
    .number()
    .int('Enter a whole number')
    .min(GROUP_LIMITS.minMembers, `A group needs at least ${GROUP_LIMITS.minMembers} members`)
    .max(GROUP_LIMITS.maxMembers, `A group can have at most ${GROUP_LIMITS.maxMembers} members`),
  recipientContributes: z.boolean({ message: 'Choose whether the recipient also contributes' })
})

export const payoutSettingsSchema = z.object({
  positionMethod: z.enum(POSITION_METHOD, { message: 'Choose how payout positions are decided' }),
  recipientCanConfirm: z.boolean().default(true)
})

export const rulesSchema = z.object({
  rules: z.string().trim().min(20, 'Write at least a few lines of rules').max(5000, 'Use at most 5,000 characters')
})

export const createGroupSchema = groupInfoSchema
  .extend(contributionSettingsSchema.shape)
  .extend(payoutSettingsSchema.shape)
  .extend(rulesSchema.shape)

/** Partial updates. Contribution/payout fields are only accepted while the group is a draft (enforced in the service). */
export const updateGroupSchema = groupInfoSchema
  .extend(contributionSettingsSchema.shape)
  .extend(payoutSettingsSchema.shape)
  .partial()
  .refine(data => Object.keys(data).length > 0, 'Nothing to update')

export const reportFeeSchema = z.object({
  senderName: z.string().trim().min(2, 'Enter the name on the sending account').max(100),
  transferDate: z
    .string()
    .refine(isValidYmd, 'Choose a valid date')
    .refine(value => value <= lagosToday(), 'The transfer date cannot be in the future'),
  transferReference: z.string().trim().max(100).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  evidenceKey: z.string().max(300).regex(/^evidence\/fee\/[a-f\d]{24}\/[\w-]+\.(jpg|png|webp|pdf)$/, 'Invalid upload').optional()
})

export const rejectFeeSchema = z.object({
  reason: z.string().trim().min(5, 'Explain why, so the owner can fix it').max(500)
})

export const cancelGroupSchema = z.object({
  reason: z.string().trim().max(500).optional().default('')
})

export const groupIdParamsSchema = z.object({ id: objectIdSchema })

export const feeListQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'rejected', 'all']).default('pending'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})
