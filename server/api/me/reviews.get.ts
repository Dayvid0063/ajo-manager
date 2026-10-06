// server/api/me/reviews.get.ts
// Payments other members reported that the caller may confirm or reject.
import { listReviewQueue } from '../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return listReviewQueue(user.id)
})
