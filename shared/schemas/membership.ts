// shared/schemas/membership.ts
// Joining, approvals, roles, rule acceptance, positions and activation.
import { z } from 'zod'
import { isValidYmd, lagosToday } from '../utils/dates'
import { objectIdSchema } from './common'

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{6}$/, 'Enter the 6-character code, e.g. DT46G8')

export const joinCodeParamsSchema = z.object({ code: inviteCodeSchema })

export const memberParamsSchema = z.object({ id: objectIdSchema, memberId: objectIdSchema })

export const decideMemberSchema = z.object({
  reason: z.string().trim().max(300).optional().default('')
})

export const setRoleSchema = z.object({
  role: z.enum(['admin', 'member'], { message: 'Choose admin or member' })
})

export const acceptRulesSchema = z.object({
  version: z.number().int().min(1)
})

export const assignPositionSchema = z.object({
  // null clears the position
  position: z.number().int().min(1).nullable()
})

export const pickPositionSchema = z.object({
  position: z.number().int().min(1)
})

export const activateGroupSchema = z.object({
  // Only needed when the planned first due date has already passed
  startDate: z
    .string()
    .refine(isValidYmd, 'Choose a valid date')
    .refine(value => value >= lagosToday(), 'Choose today or a later date')
    .optional(),
  // The owner must explicitly confirm starting with fewer members than planned
  confirmFewerMembers: z.boolean().optional()
})
