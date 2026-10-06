// server/services/cycle.ts
// End of cycle (brief §9): active → completed only after every round is
// completed — automatically when the last payment is confirmed — or resolved
// by the owner closing the cycle once the final due date has passed (with a
// reason; outstanding payments stay on record). Plus the end-of-cycle summary.
import type { ClientSession, Types } from 'mongoose'
import { formatLagosDate, lagosToday, toLagosYmd } from '#shared/utils/dates'
import { Dispute } from '../models/dispute'
import { Group } from '../models/group'
import { GroupMember } from '../models/group-member'
import { Obligation } from '../models/obligation'
import { Round } from '../models/round'
import { User } from '../models/user'
import { withTransaction } from '../utils/db'
import { conflict } from '../utils/errors'
import { recordAudit } from './audit'
import { loadGroupForMember } from './groups'
import { notify } from './notifications'

async function finish(
  groupId: Types.ObjectId | string,
  actorId: string | null,
  session: ClientSession,
  details: { reason?: string, outstanding: number, closedEarly: boolean, correlationId?: string }
) {
  const group = await Group.findOneAndUpdate(
    { _id: groupId, status: 'active' },
    { $set: { status: 'completed', completedAt: new Date() } },
    { returnDocument: 'after', session }
  )
  if (!group) return null

  await recordAudit(
    {
      actor: actorId,
      action: 'cycle.completed',
      entityType: 'group',
      entityId: group._id,
      group: group._id,
      before: { status: 'active' },
      after: { status: 'completed', closedEarly: details.closedEarly, outstandingPayments: details.outstanding },
      reason: details.reason,
      correlationId: details.correlationId
    },
    session
  )
  const members = await GroupMember.find({ group: group._id, status: 'approved' }).select('user').session(session).lean()
  await notify(
    members.map(m => m.user!),
    {
      type: 'cycle.completed',
      title: `"${group.name}" cycle completed`,
      body: details.outstanding
        ? `The cycle was closed with ${details.outstanding} payment(s) still unconfirmed. See the summary for details.`
        : 'Every payment in every round was confirmed. Well done, everyone! See the summary.',
      data: { groupId: String(group._id), link: `/groups/${group._id}/summary` }
    },
    session
  )
  return group
}

/** Called after a round completes: finishes the cycle if every round is done. */
export async function maybeCompleteCycle(groupId: Types.ObjectId | string, session: ClientSession, correlationId?: string) {
  const remaining = await Round.countDocuments({ group: groupId, status: { $ne: 'completed' } }).session(session)
  if (remaining > 0) return false
  return !!(await finish(groupId, null, session, { outstanding: 0, closedEarly: false, correlationId }))
}

/** Owner closes the cycle once the final due date has passed (some payments may be outstanding). */
export async function closeCycle(groupId: string, userId: string, reason: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, userId, ['owner'], session)
    if (group.status !== 'active') throw conflict('Only a running group can be closed.')
    const last = await Round.findOne({ group: group._id }).sort({ index: -1 }).session(session).lean()
    if (!last?.dueDate || toLagosYmd(last.dueDate) >= lagosToday()) {
      throw conflict(`The cycle can be closed after the last round's due date (${last?.dueDate ? formatLagosDate(last.dueDate) : '—'}).`)
    }
    const outstanding = await Obligation.countDocuments({ group: group._id, status: { $ne: 'confirmed' } }).session(session)
    await finish(group._id, userId, session, { reason, outstanding, closedEarly: true, correlationId })
    return { status: 'completed', outstanding }
  })
}

/** End-of-cycle (or progress-so-far) summary for every member — visible to all members. */
export async function getCycleSummary(groupId: string, userId: string) {
  const { group } = await loadGroupForMember(groupId, userId)
  const [members, rounds, obligations, disputes] = await Promise.all([
    GroupMember.find({ group: group._id, status: 'approved' }).lean(),
    Round.find({ group: group._id }).sort({ index: 1 }).lean(),
    Obligation.find({ group: group._id }).lean(),
    Dispute.aggregate<{ _id: string, count: number }>([{ $match: { group: group._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  ])
  const users = await User.find({ _id: { $in: members.map(m => m.user) } }).select('name').lean()
  const nameById = new Map(users.map(u => [String(u._id), u.name || 'Member']))

  const rows = members
    .map((member) => {
      const id = String(member._id)
      const myRound = rounds.find(r => String(r.recipientMember) === id)
      const paid = obligations.filter(o => String(o.contributorMember) === id)
      const received = myRound ? obligations.filter(o => String(o.round) === String(myRound._id)) : []
      const sum = (list: typeof obligations) => list.reduce((total, o) => total + (o.expectedAmount ?? 0), 0)
      return {
        memberId: id,
        name: nameById.get(String(member.user)) ?? 'Member',
        isMe: String(member.user) === userId,
        position: member.position ?? null,
        payoutDate: myRound?.dueDate ? toLagosYmd(myRound.dueDate) : '',
        expectedPayout: myRound?.expectedPayout ?? 0,
        receivedConfirmed: sum(received.filter(o => o.status === 'confirmed')),
        expectedToPay: sum(paid),
        paidConfirmed: sum(paid.filter(o => o.status === 'confirmed')),
        outstanding: paid.filter(o => o.status !== 'confirmed').length
      }
    })
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))

  const disputeCounts = Object.fromEntries(disputes.map(d => [d._id, d.count]))
  const confirmed = obligations.filter(o => o.status === 'confirmed')
  return {
    status: group.status ?? 'active',
    activatedAt: group.activatedAt ?? null,
    completedAt: group.completedAt ?? null,
    rounds: { total: rounds.length, completed: rounds.filter(r => r.status === 'completed').length },
    payments: {
      total: obligations.length,
      confirmed: confirmed.length,
      confirmedAmount: confirmed.reduce((t, o) => t + (o.expectedAmount ?? 0), 0),
      expectedAmount: obligations.reduce((t, o) => t + (o.expectedAmount ?? 0), 0)
    },
    disputes: {
      open: (disputeCounts.open ?? 0) + (disputeCounts.under_review ?? 0),
      resolved: disputeCounts.resolved ?? 0,
      rejected: disputeCounts.rejected ?? 0
    },
    lastDueDate: rounds.at(-1)?.dueDate ? toLagosYmd(rounds.at(-1)!.dueDate!) : '',
    canClose: group.status === 'active' && !!rounds.at(-1)?.dueDate && toLagosYmd(rounds.at(-1)!.dueDate!) < lagosToday(),
    members: rows
  }
}
