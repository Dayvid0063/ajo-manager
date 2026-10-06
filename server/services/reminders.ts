// server/services/reminders.ts
// Scheduled in-app reminders (brief §14). Runs hourly; every reminder has a
// dedupe key, so running it again (or twice at once) never sends duplicates.
// Times are Lagos calendar days. Never include bank details.
import { addPeriods, formatLagosDate, lagosYmdToDate, toLagosYmd } from '#shared/utils/dates'
import { formatKobo } from '#shared/utils/money'
import { DUE_SOON_DAYS } from '#shared/constants'
import { daysBetween } from '#shared/utils/obligation-status'
import { Group } from '../models/group'
import { Notification } from '../models/notification'
import { Obligation } from '../models/obligation'
import { Round } from '../models/round'
import { User } from '../models/user'
import type { Types } from 'mongoose'
import type { NotificationPayload } from './notifications'

// Check-then-insert: fine for one hourly job on a single server instance.
// (If the app is ever scaled to several instances, add a unique index on the dedupe key.)
async function sendOnce(userId: Types.ObjectId | null | undefined, dedupeKey: string, payload: NotificationPayload) {
  if (!userId) return false
  if (await Notification.exists({ user: userId, 'data.dedupeKey': dedupeKey })) return false
  await Notification.create({ user: userId, ...payload, data: { ...payload.data, dedupeKey }, channel: 'in_app' })
  return true
}

export async function runReminders(now = new Date()) {
  const today = toLagosYmd(now)
  const horizon = lagosYmdToDate(addPeriods(today, 'weekly', 1)) // look a week ahead
  const groups = await Group.find({ status: 'active' }).select('name').lean()
  const groupById = new Map(groups.map(g => [String(g._id), g]))
  const groupIds = groups.map(g => g._id)
  let sent = 0

  // Members who still owe (pending, or a rejected claim to redo)
  const owing = await Obligation.find({
    group: { $in: groupIds },
    status: { $in: ['pending', 'rejected'] },
    dueDate: { $lt: horizon }
  }).lean()
  const rounds = await Round.find({ _id: { $in: owing.map(o => o.round) } }).select('index recipientUser').lean()
  const roundById = new Map(rounds.map(r => [String(r._id), r]))
  const recipients = await User.find({ _id: { $in: rounds.map(r => r.recipientUser) } }).select('name').lean()
  const nameById = new Map(recipients.map(u => [String(u._id), u.name || 'the recipient']))

  for (const o of owing) {
    const due = toLagosYmd(o.dueDate!)
    const days = daysBetween(today, due)
    const group = groupById.get(String(o.group))
    const round = roundById.get(String(o.round))
    const who = nameById.get(String(round?.recipientUser)) ?? 'the recipient'
    const amount = formatKobo(o.expectedAmount ?? 0)
    const link = `/payments/${o._id}`
    const data = { groupId: String(o.group), obligationId: String(o._id), link }

    let kind: string | null = null
    let payload: NotificationPayload | null = null
    if (days < 0) {
      kind = 'overdue'
      payload = { type: 'contribution.overdue', title: 'Payment overdue', body: `Your ${amount} payment to ${who} in "${group?.name}" was due ${formatLagosDate(due)}. Please pay and mark it as paid.`, data }
    } else if (days === 0) {
      kind = 'due_today'
      payload = { type: 'contribution.due_today', title: 'Payment due today', body: `Pay ${amount} to ${who} today for "${group?.name}".`, data }
    } else if (days <= DUE_SOON_DAYS) {
      kind = 'due_soon'
      payload = { type: 'contribution.due_soon', title: 'Payment due soon', body: `Your ${amount} payment to ${who} in "${group?.name}" is due ${formatLagosDate(due)}.`, data }
    }
    if (kind && payload && (await sendOnce(o.contributorUser, `${kind}:${o._id}`, payload))) sent++
  }

  // Recipients: payout approaching, and "it's your turn"
  const upcomingRounds = await Round.find({ group: { $in: groupIds }, status: { $ne: 'completed' }, dueDate: { $lt: horizon } }).lean()
  for (const r of upcomingRounds) {
    const due = toLagosYmd(r.dueDate!)
    const days = daysBetween(today, due)
    const group = groupById.get(String(r.group))
    const data = { groupId: String(r.group), link: `/groups/${r.group}/contributions` }
    const payout = formatKobo(r.expectedPayout ?? 0)
    if (days === 0) {
      if (await sendOnce(r.recipientUser, `recipient_today:${r._id}`, {
        type: 'payout.current_recipient',
        title: 'It\'s your payout round',
        body: `Members of "${group?.name}" pay you today (${payout} expected). Confirm each payment when it arrives.`,
        data
      })) sent++
    } else if (days > 0 && days <= DUE_SOON_DAYS) {
      if (await sendOnce(r.recipientUser, `payout_soon:${r._id}`, {
        type: 'payout.approaching',
        title: 'Your payout is coming up',
        body: `Your ${payout} payout from "${group?.name}" is due ${formatLagosDate(due)}. Check your payout account details are correct.`,
        data
      })) sent++
    }
  }

  return { sent }
}
