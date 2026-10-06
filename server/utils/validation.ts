// server/utils/validation.ts
// Zod validation for every privileged route. Invalid input becomes a 400 with
// field-level messages the UI can show next to each input.
import { getQuery, getRouterParams, readBody } from 'h3'
import type { H3Event } from 'h3'
import type { z } from 'zod'
import { toFieldErrors } from '#shared/utils/zod'
import { badRequest } from './errors'

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw badRequest('Please check the highlighted fields.', { fields: toFieldErrors(result.error) })
  }
  return result.data
}

export async function validateBody<S extends z.ZodType>(event: H3Event, schema: S): Promise<z.output<S>> {
  const body = await readBody(event).catch(() => {
    throw badRequest('The request body could not be read.')
  })
  return parseOrThrow(schema, body)
}

export function validateQuery<S extends z.ZodType>(event: H3Event, schema: S): z.output<S> {
  return parseOrThrow(schema, getQuery(event))
}

export function validateParams<S extends z.ZodType>(event: H3Event, schema: S): z.output<S> {
  return parseOrThrow(schema, getRouterParams(event))
}
