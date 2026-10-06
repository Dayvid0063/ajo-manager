// shared/utils/zod.ts
// Turns Zod issues into { field: [messages] } — used by server responses and
// by client forms for instant feedback with the same shared schemas.
import type { z } from 'zod'

export interface FieldErrors {
  [field: string]: string[]
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_'
    ;(fields[key] ??= []).push(issue.message)
  }
  return fields
}
