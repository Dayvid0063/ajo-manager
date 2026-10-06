// server/utils/errors.ts
import { createError } from 'h3'

// Safe, consistent API errors. Messages are written for end users and never
// include internal details (stack traces, queries, other users' data).

export function badRequest(message = 'Please check the details and try again.', data?: unknown) {
  return createError({ statusCode: 400, statusMessage: 'Bad Request', message, data })
}

export function unauthorized(message = 'Please log in to continue.') {
  return createError({ statusCode: 401, statusMessage: 'Unauthorized', message })
}

export function forbidden(message = 'You are not allowed to do this.') {
  return createError({ statusCode: 403, statusMessage: 'Forbidden', message })
}

/** Also used when a user may not know a resource exists — don't leak existence. */
export function notFound(message = 'We could not find what you were looking for.') {
  return createError({ statusCode: 404, statusMessage: 'Not Found', message })
}

/** Invalid state transition or duplicate (e.g. position already taken). */
export function conflict(message = 'This action is not possible right now.') {
  return createError({ statusCode: 409, statusMessage: 'Conflict', message })
}
