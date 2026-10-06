// shared/schemas/auth.ts
// Auth and profile input schemas, shared by forms (instant feedback) and the API (enforcement).
import { z } from 'zod'
import { emailSchema, passwordSchema } from './common'

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine(data => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match'
  })

export const loginSchema = z.object({
  email: emailSchema,
  // Don't apply password rules on login — old/temporary passwords must still work
  password: z.string().min(1, 'Enter your password').max(128)
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match'
  })
  .refine(data => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one'
  })

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80, 'Use at most 80 characters'),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+?\d[\d\s-]{6,18}\d)?$/, 'Enter a valid phone number, e.g. 0803 123 4567')
    .optional()
    .default('')
})

export const userSearchSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})
