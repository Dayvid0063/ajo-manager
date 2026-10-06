// shared/schemas/disputes.ts
import { z } from 'zod'
import { DISPUTE_CATEGORY, DISPUTE_STATUS } from '../constants'
import { objectIdSchema } from './common'

export const openDisputeSchema = z.object({
  category: z.enum(DISPUTE_CATEGORY, { message: 'Choose what the problem is about' }),
  description: z.string().trim().min(10, 'Describe what happened in a sentence or two').max(2000),
  obligationId: objectIdSchema.optional()
})

export const disputeMessageSchema = z.object({
  body: z.string().trim().min(2, 'Write a message').max(2000)
})

export const resolveDisputeSchema = z.object({
  outcome: z.enum(['resolved', 'rejected']),
  resolution: z.string().trim().min(5, 'Explain the outcome for everyone involved').max(2000)
})

export const disputeListQuerySchema = z.object({
  status: z.enum([...DISPUTE_STATUS, 'active', 'all']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})

export const closeCycleSchema = z.object({
  reason: z.string().trim().min(5, 'Explain why the cycle is being closed').max(500)
})

export const adminGroupsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  status: z.enum(['draft', 'awaiting_members', 'active', 'completed', 'cancelled', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})

export const auditQuerySchema = z.object({
  group: objectIdSchema.optional(),
  action: z.string().trim().max(60).regex(/^[a-z_.]*$/).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})
