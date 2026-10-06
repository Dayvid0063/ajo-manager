// server/services/payments.ts
// Contribution tracking (brief §10). Members pay the round's recipient OUTSIDE
// the app, then "Mark as paid" — a claim, not proof. The recipient (if the group
// allows) or an owner/admin confirms or rejects it. Nobody reviews their own claim.
import type { ClientSession, Types } from 'mongoose'
import { formatLagosDate, lagosToday, lagosYmdToDate, toLagosYmd } from '#shared/utils/dates'
import { formatKobo } from '#shared/utils/money'
import { displayStatus, dueText } from '#shared/utils/obligation-status'
import { ContributionRecord, type ContributionRecordDoc } from '../models/contribution-record'
import { Group } from '../models/group'
import { GroupMember } from '../models/group-member'
import { Obligation } from '../models/obligation'
import { Round } from '../models/round'
import { User } from '../models/user'
import { withTransaction } from '../utils/db'
import { badRequest, conflict, forbidden, notFound } from '../utils/errors'
import { recordAudit } from './audit'
import { getAccountForMember } from './bank-accounts'
import { maybeCompleteCycle } from './cycle'
import { openDisputeCountForObligation } from './disputes'
import { loadGroupForMember } from './groups'
import { managerUserIds } from './membership'
import { notify } from './notifications'
import { evidenceKeyBelongsTo, evidenceKeyFor, type Storage } from './storage'

const MANAGER_ROLES = ['owner', 'admin']

type Id = Types.ObjectId | string
type RecordWithId = ContributionRecordDoc & { _id: Types.ObjectId, createdAt?: Date }

export interface PaymentDeps {
  storage: Storage
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function loadObligationContext(obligationId: string, userId: string, session?: ClientSession) {
  const obligation = await Obligation.findById(obligationId).session(session ?? null)
  if (!obligation) throw notFound('Payment not found.')
  const { group, membership } = await loadGroupForMember(String(obligation.group), userId, undefined, session)
  const round = await Round.findById(obligation.round).session(session ?? null)
  if (!round) throw notFound('Payment not found.')
  return { obligation, group, membership, round }
}

function isManager(membership: { role?: string | null }) {
  return MANAGER_ROLES.includes(membership.role ?? '')
}

/** Who may confirm/reject: owner/admins, or the round's recipient when the group allows — never the submitter. */
export function canReview(input: {
  userId: string
  submittedBy: Id | null | undefined
  membershipRole: string | null | undefined
  recipientUser: Id | null | undefined
  recipientCanConfirm: boolean | null | undefined
}) {
  if (String(input.submittedBy) === input.userId) return false
  if (MANAGER_ROLES.includes(input.membershipRole ?? '')) return true
  return input.recipientCanConfirm !== false && String(input.recipientUser) === input.userId
}

function toRecordDto(record: RecordWithId, options: { canReview: boolean }) {
  return {
    id: String(record._id),
    status: record.status ?? 'submitted',
    amount: record.amount ?? 0,
    paymentDate: record.paymentDate ? toLagosYmd(record.paymentDate) : '',
    method: record.method ?? 'bank_transfer',
    reference: record.reference ?? '',
    note: record.note ?? '',
    hasEvidence: !!record.evidenceKey,
    submittedAt: record.createdAt ?? null,
    reviewedAt: record.reviewedAt ?? null,
    rejectionReason: record.rejectionReason ?? '',
    canReview: options.canReview && record.status === 'submitted'
  }
}

async function namesById(userIds: Id[]) {
  const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
  return new Map(users.map(u => [String(u._id), u.name || 'Member']))
}

// ── Obligation detail ─────────────────────────────────────────────────────

export async function getObligationDetail(obligationId: string, userId: string) {
  const { obligation, group, membership, round } = await loadObligationContext(obligationId, userId)
  const isMine = String(obligation.contributorUser) === userId
  const isRecipient = String(round.recipientUser) === userId
  const manager = isManager(membership)
  if (!isMine && !isRecipient && !manager) throw notFound('Payment not found.')

  const today = lagosToday()
  const due = toLagosYmd(obligation.dueDate!)
  const [records, names, totalRounds] = await Promise.all([
    ContributionRecord.find({ obligation: obligation._id }).sort({ createdAt: -1 }).lean(),
    namesById([obligation.contributorUser!, round.recipientUser!]),
    Round.countDocuments({ group: group._id })
  ])
  // Bank details only for the person who owes this payment, and managers (brief §4.12)
  const bank = isMine || manager ? await getAccountForMember(round.recipientMember!) : null

  return {
    obligation: {
      id: String(obligation._id),
      groupId: String(group._id),
      groupName: group.name ?? '',
      roundIndex: round.index ?? 0,
      totalRounds,
      amount: obligation.expectedAmount ?? 0,
      dueDate: due,
      status: obligation.status ?? 'pending',
      displayStatus: displayStatus(obligation.status ?? 'pending', due, today),
      dueText: dueText(due, today),
      contributorName: names.get(String(obligation.contributorUser)) ?? 'Member',
      isMine,
      isRecipient
    },
    recipient: {
      name: names.get(String(round.recipientUser)) ?? 'Member',
      bank,
      canSeeBank: isMine || manager
    },
    records: records.map(record =>
      toRecordDto(record, {
        canReview: canReview({
          userId,
          submittedBy: record.submittedBy,
          membershipRole: membership.role,
          recipientUser: round.recipientUser,
          recipientCanConfirm: group.recipientCanConfirm
        })
      })
    ),
    canSubmit: isMine && group.status === 'active' && ['pending', 'rejected'].includes(obligation.status ?? ''),
    // Derived: shown as "In dispute" while a dispute about this payment is open
    openDisputes: await openDisputeCountForObligation(String(obligation._id))
  }
}

// ── Mark as paid ──────────────────────────────────────────────────────────

export interface MarkPaidInput {
  amount: number
  paymentDate: string
  method: string
  reference?: string
  note?: string
  evidenceKey?: string
}

async function assertEvidence(key: string | undefined, purpose: 'contribution' | 'fee', targetId: string, deps?: PaymentDeps) {
  if (!key) return
  if (!evidenceKeyBelongsTo(key, purpose, targetId)) throw badRequest('That upload does not belong to this payment.')
  if (!deps?.storage.configured) throw badRequest('Uploads are not available right now. Remove the attachment and add a reference instead.')
  if (!(await deps.storage.exists(key))) throw badRequest('We could not find your upload. Please attach the file again.')
}

export async function submitPayment(obligationId: string, userId: string, input: MarkPaidInput, deps: PaymentDeps, correlationId?: string) {
  await assertEvidence(input.evidenceKey, 'contribution', obligationId, deps)

  return withTransaction(async (session) => {
    const { obligation, group, round } = await loadObligationContext(obligationId, userId, session)
    if (String(obligation.contributorUser) !== userId) {
      throw forbidden('Only the member who owes this payment can mark it as paid.')
    }
    if (group.status !== 'active') throw conflict('This group is not running.')
    if (input.amount !== obligation.expectedAmount) {
      // Partial payments are post-MVP
      throw badRequest(`Mark as paid only when you've paid the full ${formatKobo(obligation.expectedAmount ?? 0)}.`, {
        fields: { amount: [`Enter the full amount: ${formatKobo(obligation.expectedAmount ?? 0)}`] }
      })
    }

    // Conditional: only from pending/rejected, so two submissions can't both succeed
    const updated = await Obligation.findOneAndUpdate(
      { _id: obligation._id, status: { $in: ['pending', 'rejected'] } },
      { $set: { status: 'submitted' } },
      { returnDocument: 'after', session }
    )
    if (!updated) {
      throw conflict(obligation.status === 'confirmed' ? 'This payment is already confirmed.' : 'You already marked this as paid. Please wait for it to be confirmed.')
    }

    const [record] = await ContributionRecord.create(
      [{
        obligation: obligation._id,
        group: group._id,
        round: round._id,
        contributorMember: obligation.contributorMember,
        submittedBy: userId,
        amount: input.amount,
        paymentDate: lagosYmdToDate(input.paymentDate),
        method: input.method,
        reference: input.reference ?? '',
        note: input.note ?? '',
        evidenceKey: input.evidenceKey,
        status: 'submitted'
      }],
      { session }
    )

    await recordAudit(
      {
        actor: userId,
        action: 'payment.submitted',
        entityType: 'contribution_record',
        entityId: record!._id,
        group: group._id,
        after: { obligation: String(obligation._id), round: round.index, amount: input.amount, method: input.method, reference: input.reference ?? '', hasEvidence: !!input.evidenceKey },
        correlationId
      },
      session
    )

    // Ask the people who can confirm (never the submitter)
    const reviewers = new Set((await managerUserIds(group._id, session)).map(String))
    if (group.recipientCanConfirm !== false) reviewers.add(String(round.recipientUser))
    reviewers.delete(userId)
    const name = (await User.findById(userId).select('name').session(session).lean())?.name || 'A member'
    await notify(
      [...reviewers],
      {
        type: 'payment.submitted',
        title: 'Payment to confirm',
        body: `${name} says they paid ${formatKobo(input.amount)} for round ${round.index} of "${group.name}". Please check and confirm.`,
        data: { groupId: String(group._id), obligationId: String(obligation._id), link: `/payments/${obligation._id}` }
      },
      session
    )

    return toRecordDto(record as RecordWithId, { canReview: false })
  })
}

// ── Review ────────────────────────────────────────────────────────────────

export async function reviewRecord(
  recordId: string,
  userId: string,
  decision: { action: 'confirm' } | { action: 'reject', reason: string },
  correlationId?: string
) {
  return withTransaction(async (session) => {
    const record = await ContributionRecord.findById(recordId).session(session)
    if (!record) throw notFound('Payment not found.')
    const { obligation, group, membership, round } = await loadObligationContext(String(record.obligation), userId, session)
    const allowed = canReview({
      userId,
      submittedBy: record.submittedBy,
      membershipRole: membership.role,
      recipientUser: round.recipientUser,
      recipientCanConfirm: group.recipientCanConfirm
    })
    if (!allowed) throw forbidden(String(record.submittedBy) === userId ? 'You cannot confirm your own payment.' : 'Only the recipient or a group admin can review this payment.')

    const confirming = decision.action === 'confirm'
    // Conditional: a record is reviewed exactly once
    const reviewed = await ContributionRecord.findOneAndUpdate(
      { _id: record._id, status: 'submitted' },
      {
        $set: {
          status: confirming ? 'confirmed' : 'rejected',
          reviewedBy: userId,
          reviewedAt: new Date(),
          ...(confirming ? {} : { rejectionReason: decision.reason })
        }
      },
      { returnDocument: 'after', session }
    )
    if (!reviewed) throw conflict('This payment has already been reviewed.')

    await Obligation.updateOne(
      { _id: obligation._id, status: 'submitted' },
      { $set: { status: confirming ? 'confirmed' : 'rejected' } },
      { session }
    )

    let roundCompleted = false
    if (confirming) {
      const outstanding = await Obligation.countDocuments({ round: round._id, status: { $ne: 'confirmed' } }).session(session)
      if (outstanding === 0) {
        await Round.updateOne({ _id: round._id }, { $set: { status: 'completed' } }, { session })
        roundCompleted = true
      }
    }

    await recordAudit(
      {
        actor: userId,
        action: confirming ? 'payment.confirmed' : 'payment.rejected',
        entityType: 'contribution_record',
        entityId: record._id,
        group: group._id,
        before: { status: 'submitted' },
        after: { status: confirming ? 'confirmed' : 'rejected', round: round.index, roundCompleted },
        reason: confirming ? undefined : decision.reason,
        correlationId
      },
      session
    )

    const amount = formatKobo(record.amount ?? 0)
    await notify(
      [record.submittedBy!],
      confirming
        ? {
            type: 'payment.confirmed',
            title: 'Payment confirmed',
            body: `Your ${amount} payment for round ${round.index} of "${group.name}" was confirmed.`,
            data: { groupId: String(group._id), obligationId: String(obligation._id), link: `/payments/${obligation._id}` }
          }
        : {
            type: 'payment.rejected',
            title: 'Payment not confirmed',
            body: `Your ${amount} payment for round ${round.index} of "${group.name}" was not confirmed. Reason: ${decision.reason}`,
            data: { groupId: String(group._id), obligationId: String(obligation._id), link: `/payments/${obligation._id}` }
          },
      session
    )
    if (roundCompleted) {
      await notify(
        [round.recipientUser!],
        {
          type: 'round.completed',
          title: 'Every payment confirmed',
          body: `All payments for your round in "${group.name}" are confirmed.`,
          data: { groupId: String(group._id), link: `/groups/${group._id}/contributions` }
        },
        session
      )
    }

    // Last payment of the last round → the whole cycle is complete
    const cycleCompleted = roundCompleted ? await maybeCompleteCycle(group._id, session, correlationId) : false

    return { record: toRecordDto(reviewed as RecordWithId, { canReview: false }), roundCompleted, cycleCompleted }
  })
}

// ── Evidence ──────────────────────────────────────────────────────────────

export async function createEvidenceUpload(
  userId: string,
  input: { purpose: 'contribution' | 'fee', targetId: string, contentType: string, size: number },
  deps: PaymentDeps
) {
  if (!deps.storage.configured) {
    throw createUnavailable()
  }
  if (input.purpose === 'contribution') {
    const { obligation, group } = await loadObligationContext(input.targetId, userId)
    if (String(obligation.contributorUser) !== userId) throw forbidden('You can only attach proof to your own payment.')
    if (group.status !== 'active') throw conflict('This group is not running.')
  } else {
    const { group } = await loadGroupForMember(input.targetId, userId, ['owner'])
    if (group.status !== 'draft') throw conflict('The platform fee can only be reported while the group is being set up.')
  }
  const key = evidenceKeyFor(input.purpose, input.targetId, input.contentType)
  const uploadUrl = await deps.storage.presignPut(key, input.contentType, 300)
  return { key, uploadUrl, headers: { 'content-type': input.contentType } }
}

function createUnavailable() {
  const error = conflict('Uploads are not available right now. Add the transfer reference instead.')
  error.statusCode = 503
  error.statusMessage = 'Service Unavailable'
  return error
}

/** Signed, short-lived link to a record's evidence — after checking who is asking. */
export async function recordEvidenceUrl(recordId: string, userId: string, deps: PaymentDeps) {
  const record = await ContributionRecord.findById(recordId).lean()
  if (!record?.evidenceKey) throw notFound('No attachment for this payment.')
  const { membership, round } = await loadObligationContext(String(record.obligation), userId)
  // The payer, the person who was paid, and the group's owner/admins
  const allowed = String(record.submittedBy) === userId || String(round.recipientUser) === userId || isManager(membership)
  if (!allowed) throw notFound('No attachment for this payment.')
  if (!deps.storage.configured) throw createUnavailable()
  return { url: await deps.storage.presignGet(record.evidenceKey, 60) }
}

// ── Lists & dashboard ─────────────────────────────────────────────────────

async function activeGroupsFor(userId: string) {
  const memberships = await GroupMember.find({ user: userId, status: 'approved' }).lean()
  const groups = await Group.find({ _id: { $in: memberships.map(m => m.group) }, status: 'active' }).lean()
  return { memberships, groups }
}

/** Everything the member owes (open = not yet confirmed), across their running groups. */
export async function listMyObligations(userId: string, input: { filter: 'open' | 'all', page: number, limit: number }) {
  const today = lagosToday()
  const filter = {
    contributorUser: userId,
    ...(input.filter === 'open' ? { status: { $ne: 'confirmed' } } : {})
  }
  const [obligations, total] = await Promise.all([
    Obligation.find(filter)
      .sort(input.filter === 'open' ? { dueDate: 1 } : { dueDate: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean(),
    Obligation.countDocuments(filter)
  ])
  const [rounds, groups] = await Promise.all([
    Round.find({ _id: { $in: obligations.map(o => o.round) } }).lean(),
    Group.find({ _id: { $in: obligations.map(o => o.group) } }).select('name status').lean()
  ])
  const roundById = new Map(rounds.map(r => [String(r._id), r]))
  const groupById = new Map(groups.map(g => [String(g._id), g]))
  const names = await namesById(rounds.map(r => r.recipientUser!))

  return {
    items: obligations.map((o) => {
      const round = roundById.get(String(o.round))
      const due = toLagosYmd(o.dueDate!)
      return {
        id: String(o._id),
        groupId: String(o.group),
        groupName: groupById.get(String(o.group))?.name ?? '',
        roundIndex: round?.index ?? 0,
        recipientName: names.get(String(round?.recipientUser)) ?? 'Member',
        amount: o.expectedAmount ?? 0,
        dueDate: due,
        status: o.status ?? 'pending',
        displayStatus: displayStatus(o.status ?? 'pending', due, today),
        dueText: dueText(due, today)
      }
    }),
    total,
    page: input.page,
    limit: input.limit
  }
}

/**
 * Home dashboard (brief §8): how much do I owe, who am I paying, when is it due,
 * what's the status, when is my payout — plus payments waiting for my confirmation.
 */
export async function getDashboard(userId: string) {
  const today = lagosToday()
  const { memberships, groups } = await activeGroupsFor(userId)
  const groupIds = groups.map(g => g._id)
  const groupById = new Map(groups.map(g => [String(g._id), g]))
  const roleByGroup = new Map(memberships.map(m => [String(m.group), m.role]))

  // Next unconfirmed payment per group
  const open = await Obligation.find({ group: { $in: groupIds }, contributorUser: userId, status: { $ne: 'confirmed' } })
    .sort({ dueDate: 1 })
    .lean()
  const nextByGroup = new Map<string, typeof open[number]>()
  for (const o of open) if (!nextByGroup.has(String(o.group))) nextByGroup.set(String(o.group), o)

  // My next payout per group
  const myRounds = await Round.find({ group: { $in: groupIds }, recipientUser: userId, status: { $ne: 'completed' } }).sort({ dueDate: 1 }).lean()
  const payoutByGroup = new Map<string, typeof myRounds[number]>()
  for (const r of myRounds) if (!payoutByGroup.has(String(r.group))) payoutByGroup.set(String(r.group), r)

  const roundIds = [...nextByGroup.values()].map(o => o.round).concat([...payoutByGroup.values()].map(r => r._id))
  const rounds = await Round.find({ _id: { $in: roundIds } }).lean()
  const roundById = new Map(rounds.map(r => [String(r._id), r]))
  const names = await namesById(rounds.map(r => r.recipientUser!))

  const payoutProgress = await Promise.all(
    [...payoutByGroup.values()].map(async r => ({
      roundId: String(r._id),
      confirmed: await Obligation.countDocuments({ round: r._id, status: 'confirmed' }),
      total: await Obligation.countDocuments({ round: r._id })
    }))
  )
  const progressByRound = new Map(payoutProgress.map(p => [p.roundId, p]))

  // Payments waiting for my confirmation: as recipient (if allowed) or as owner/admin
  const managedGroups = groups.filter(g => MANAGER_ROLES.includes(roleByGroup.get(String(g._id)) ?? '')).map(g => g._id)
  const recipientRounds = await Round.find({ group: { $in: groupIds }, recipientUser: userId }).select('_id group').lean()
  const reviewRounds = recipientRounds.filter(r => groupById.get(String(r.group))?.recipientCanConfirm !== false).map(r => r._id)
  const toReview = await ContributionRecord.countDocuments({
    status: 'submitted',
    submittedBy: { $ne: userId },
    $or: [{ group: { $in: managedGroups } }, { round: { $in: reviewRounds } }]
  })

  return {
    toPay: [...nextByGroup.values()].map((o) => {
      const round = roundById.get(String(o.round))
      const due = toLagosYmd(o.dueDate!)
      return {
        obligationId: String(o._id),
        groupId: String(o.group),
        groupName: groupById.get(String(o.group))?.name ?? '',
        roundIndex: round?.index ?? 0,
        amount: o.expectedAmount ?? 0,
        recipientName: names.get(String(round?.recipientUser)) ?? 'Member',
        dueDate: due,
        status: o.status ?? 'pending',
        displayStatus: displayStatus(o.status ?? 'pending', due, today),
        dueText: dueText(due, today)
      }
    }),
    payouts: [...payoutByGroup.values()].map((r) => {
      const progress = progressByRound.get(String(r._id))
      return {
        groupId: String(r.group),
        groupName: groupById.get(String(r.group))?.name ?? '',
        roundIndex: r.index ?? 0,
        dueDate: toLagosYmd(r.dueDate!),
        expectedPayout: r.expectedPayout ?? 0,
        confirmed: progress?.confirmed ?? 0,
        total: progress?.total ?? 0
      }
    }),
    toReview,
    activeGroups: groups.length
  }
}

/** Claims waiting for the caller to confirm: as a round's recipient (if allowed) or as owner/admin. */
export async function listReviewQueue(userId: string) {
  const { memberships, groups } = await activeGroupsFor(userId)
  const groupById = new Map(groups.map(g => [String(g._id), g]))
  const managed = memberships.filter(m => MANAGER_ROLES.includes(m.role ?? '') && groupById.has(String(m.group))).map(m => m.group)
  const myRounds = await Round.find({ group: { $in: groups.map(g => g._id) }, recipientUser: userId }).select('_id group').lean()
  const reviewRounds = myRounds.filter(r => groupById.get(String(r.group))?.recipientCanConfirm !== false).map(r => r._id)

  const records = await ContributionRecord.find({
    status: 'submitted',
    submittedBy: { $ne: userId },
    $or: [{ group: { $in: managed } }, { round: { $in: reviewRounds } }]
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean()
  const rounds = await Round.find({ _id: { $in: records.map(r => r.round) } }).select('index recipientUser').lean()
  const roundById = new Map(rounds.map(r => [String(r._id), r]))
  const names = await namesById([...records.map(r => r.submittedBy!), ...rounds.map(r => r.recipientUser!)])

  return {
    items: records.map((record) => {
      const round = roundById.get(String(record.round))
      return {
        obligationId: String(record.obligation),
        groupId: String(record.group),
        groupName: groupById.get(String(record.group))?.name ?? '',
        roundIndex: round?.index ?? 0,
        payerName: names.get(String(record.submittedBy)) ?? 'Member',
        recipientName: names.get(String(round?.recipientUser)) ?? 'Member',
        isMyRound: String(round?.recipientUser) === userId,
        record: toRecordDto(record as RecordWithId, { canReview: true })
      }
    })
  }
}

/** The group's payment board: every round, every obligation, latest claim. */
export async function groupContributions(groupId: string, userId: string) {
  const { group, membership } = await loadGroupForMember(groupId, userId)
  const today = lagosToday()
  const manager = isManager(membership)
  const [rounds, obligations, records] = await Promise.all([
    Round.find({ group: group._id }).sort({ index: 1 }).lean(),
    Obligation.find({ group: group._id }).lean(),
    ContributionRecord.find({ group: group._id }).sort({ createdAt: -1 }).lean()
  ])
  const latestByObligation = new Map<string, RecordWithId>()
  for (const record of records) {
    if (!latestByObligation.has(String(record.obligation))) latestByObligation.set(String(record.obligation), record as RecordWithId)
  }
  const names = await namesById([...new Set([...rounds.map(r => String(r.recipientUser)), ...obligations.map(o => String(o.contributorUser))])])

  const currentIndex = rounds.find(r => r.status !== 'completed')?.index ?? rounds.at(-1)?.index ?? 0

  return {
    currentRound: currentIndex,
    rounds: rounds.map((round) => {
      const due = toLagosYmd(round.dueDate!)
      const isRecipient = String(round.recipientUser) === userId
      const roundObligations = obligations.filter(o => String(o.round) === String(round._id))
      return {
        id: String(round._id),
        index: round.index ?? 0,
        dueDate: due,
        dueLabel: formatLagosDate(due),
        status: round.status ?? 'upcoming',
        recipientName: names.get(String(round.recipientUser)) ?? 'Member',
        isRecipient,
        expectedPayout: round.expectedPayout ?? 0,
        confirmedCount: roundObligations.filter(o => o.status === 'confirmed').length,
        total: roundObligations.length,
        obligations: roundObligations.map((o) => {
          const record = latestByObligation.get(String(o._id))
          const isMine = String(o.contributorUser) === userId
          const reviewer = canReview({
            userId,
            submittedBy: record?.submittedBy,
            membershipRole: membership.role,
            recipientUser: round.recipientUser,
            recipientCanConfirm: group.recipientCanConfirm
          })
          // Everyone sees who has paid; claim details only for reviewers and the payer
          const showDetails = isMine || manager || isRecipient
          return {
            id: String(o._id),
            contributorName: names.get(String(o.contributorUser)) ?? 'Member',
            isMine,
            amount: o.expectedAmount ?? 0,
            status: o.status ?? 'pending',
            displayStatus: displayStatus(o.status ?? 'pending', due, today),
            latestRecord: record && showDetails ? toRecordDto(record, { canReview: reviewer }) : null
          }
        })
      }
    })
  }
}
