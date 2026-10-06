// server/api/me/dashboard.get.ts
// Home: what I owe, who I'm paying, when, status, my next payout, and what's waiting for my confirmation.
import { getDashboard } from '../../services/payments'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return getDashboard(user.id)
})
