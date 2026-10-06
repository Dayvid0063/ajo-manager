// server/services/fees.ts
// Management-fee flow (brief §18). No payment API: the owner pays ₦3,700 by
// bank transfer outside the app and reports it; a platform admin checks the
// bank and confirms or rejects. Confirmation moves the group draft →
// awaiting_members exactly once, inside one transaction.
import type { Types } from 'mongoose'
import { lagosYmdToDate, toLagosYmd } from '#shared/utils/dates'
import { formatKobo } from '#shared/utils/money'
import { Group } from '../models/group'
import { ManagementFee, type ManagementFeeDoc } from '../models/management-fee'
import { User } from '../models/user'
import { withTransaction } from '../utils/db'
import { badRequest, conflict, notFound } from '../utils/errors'
import { recordAudit } from './audit'
import { loadGroupForMember, paymentReferenceFor } from './groups'
import { notify, notifyPlatformAdmins } from './notifications'
import { evidenceKeyBelongsTo, type Storage } from './storage'

export interface FeeConfig {
  amountKobo: number
  bank: { name: string, accountNumber: string, accountName: string }
}

type FeeWithId = ManagementFeeDoc & { _id: Types.ObjectId }

function toFeeDto(fee: FeeWithId | null) {
  if (!fee) return null
  return {
    id: String(fee._id),
    status: fee.status ?? 'pending',
    amount: fee.amount ?? 0,
    paymentReference: fee.paymentReference ?? '',
    senderName: fee.senderName ?? '',
    transferDate: fee.transferDate ? toLagosYmd(fee.transferDate) : '',
    transferReference: fee.transferReference ?? '',
    note: fee.note ?? '',
    reportedAt: fee.reportedAt ?? null,
    verifiedAt: fee.verifiedAt ?? null,
    rejectionReason: fee.rejectionReason ?? '',
    previousAttempts: (fee.attempts ?? []).length,
    hasEvidence: !!fee.evidenceKey
  }
}

/** Fee instructions + current report, for the group's owner/admins. */
export async function getGroupFee(groupId: string, userId: string, config: FeeConfig) {
  const { group } = await loadGroupForMember(groupId, userId, ['owner', 'admin'])
  const fee = await ManagementFee.findOne({ group: group._id }).lean()
  return {
    groupStatus: group.status ?? 'draft',
    feeStatus: group.feeStatus ?? 'unpaid',
    amount: fee?.amount ?? config.amountKobo,
    paymentReference: paymentReferenceFor(group.inviteCode ?? ''),
    bank: config.bank,
    bankConfigured: !!(config.bank.name && config.bank.accountNumber && config.bank.accountName),
    fee: toFeeDto(fee)
  }
}

export interface ReportFeeInput {
  senderName: string
  transferDate: string
  transferReference?: string
  note?: string
  evidenceKey?: string
}

export async function reportFee(
  groupId: string,
  userId: string,
  input: ReportFeeInput,
  config: FeeConfig,
  correlationId?: string,
  deps?: { storage: Storage }
) {
  if (input.evidenceKey) {
    if (!evidenceKeyBelongsTo(input.evidenceKey, 'fee', groupId)) throw badRequest('That upload does not belong to this group.')
    if (!deps?.storage.configured || !(await deps.storage.exists(input.evidenceKey))) {
      throw badRequest('We could not find your upload. Please attach the file again.')
    }
  }

  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, userId, ['owner'], session)
    if (group.status !== 'draft') {
      throw conflict('The platform fee can only be reported for a group that has not been set up yet.')
    }

    const now = new Date()
    const report = {
      senderName: input.senderName,
      transferDate: lagosYmdToDate(input.transferDate),
      transferReference: input.transferReference ?? '',
      note: input.note ?? '',
      evidenceKey: input.evidenceKey,
      reportedBy: userId,
      reportedAt: now
    }

    const existing = await ManagementFee.findOne({ group: group._id }).session(session)
    let fee: FeeWithId
    if (!existing) {
      // The unique index on `group` stops a second record if two reports race
      const [created] = await ManagementFee.create(
        [{ group: group._id, amount: config.amountKobo, paymentReference: paymentReferenceFor(group.inviteCode ?? ''), status: 'pending', ...report }],
        { session }
      )
      fee = created as FeeWithId
    } else if (existing.status === 'rejected') {
      const { evidenceKey, ...rest } = report
      const reportFields = evidenceKey ? report : rest
      // Keep the rejected attempt in history, then re-open with the new report
      const updated = await ManagementFee.findOneAndUpdate(
        { _id: existing._id, status: 'rejected' },
        {
          $push: {
            attempts: {
              senderName: existing.senderName,
              transferDate: existing.transferDate,
              transferReference: existing.transferReference,
              note: existing.note,
              evidenceKey: existing.evidenceKey,
              reportedAt: existing.reportedAt,
              rejectedAt: existing.verifiedAt,
              rejectedBy: existing.verifiedBy,
              rejectionReason: existing.rejectionReason
            }
          },
          $set: { ...reportFields, status: 'pending' },
          // A new report without a screenshot must not keep the old one
          $unset: { verifiedBy: '', verifiedAt: '', rejectionReason: '', ...(report.evidenceKey ? {} : { evidenceKey: '' }) }
        },
        { returnDocument: 'after', session }
      )
      if (!updated) throw conflict('This fee is already being processed.')
      fee = updated as FeeWithId
    } else {
      throw conflict(existing.status === 'confirmed' ? 'The platform fee is already confirmed.' : 'You have already reported this payment. Please wait for it to be checked.')
    }

    group.feeStatus = 'pending'
    await group.save({ session })

    await recordAudit(
      {
        actor: userId,
        action: 'fee.reported',
        entityType: 'management_fee',
        entityId: fee._id,
        group: group._id,
        after: { status: 'pending', senderName: input.senderName, transferDate: input.transferDate, transferReference: input.transferReference ?? '' },
        correlationId
      },
      session
    )
    await notifyPlatformAdmins(
      {
        type: 'fee.reported',
        title: 'Platform fee to verify',
        body: `"${group.name}" reported a ${formatKobo(fee.amount ?? config.amountKobo)} platform fee payment.`,
        data: { feeId: String(fee._id), link: '/admin/fees' }
      },
      session
    )
    return toFeeDto(fee)
  })
}

// ── Platform admin ────────────────────────────────────────────────────────

export async function listFees(input: { status: 'pending' | 'confirmed' | 'rejected' | 'all', page: number, limit: number }) {
  const filter = input.status === 'all' ? {} : { status: input.status }
  const [fees, total] = await Promise.all([
    ManagementFee.find(filter)
      .sort({ reportedAt: input.status === 'pending' ? 1 : -1 }) // oldest first in the queue
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean(),
    ManagementFee.countDocuments(filter)
  ])
  const groups = await Group.find({ _id: { $in: fees.map(f => f.group) } }).select('name owner status').lean()
  const owners = await User.find({ _id: { $in: groups.map(g => g.owner) } }).select('name email').lean()
  const groupById = new Map(groups.map(g => [String(g._id), g]))
  const ownerById = new Map(owners.map(o => [String(o._id), o]))

  return {
    items: fees.map((fee) => {
      const group = groupById.get(String(fee.group))
      const owner = group ? ownerById.get(String(group.owner)) : undefined
      return {
        ...toFeeDto(fee)!,
        group: { id: String(fee.group), name: group?.name ?? '', status: group?.status ?? '' },
        owner: { name: owner?.name ?? '', email: owner?.email ?? '' }
      }
    }),
    total,
    page: input.page,
    limit: input.limit
  }
}

/**
 * Confirm a reported fee. Idempotent: confirming twice, or confirming for a
 * group that is no longer a draft, never moves the group a second time.
 */
export async function confirmFee(feeId: string, adminId: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const fee = await ManagementFee.findOneAndUpdate(
      { _id: feeId, status: 'pending' },
      { $set: { status: 'confirmed', verifiedBy: adminId, verifiedAt: new Date() } },
      { returnDocument: 'after', session }
    )
    if (!fee) {
      const current = await ManagementFee.findById(feeId).session(session).lean()
      if (!current) throw notFound('Fee record not found.')
      if (current.status === 'confirmed') return { fee: toFeeDto(current), changed: false }
      throw conflict('Only a reported (pending) fee can be confirmed.')
    }

    // Move the group forward only if it is still a draft
    const group = await Group.findOneAndUpdate(
      { _id: fee.group, status: 'draft' },
      { $set: { status: 'awaiting_members', invitesEnabled: true, feeStatus: 'confirmed' } },
      { returnDocument: 'after', session }
    )
    if (!group) {
      // Throwing rolls back the fee confirmation above too
      throw conflict('This group is no longer waiting for its fee (it may have been cancelled).')
    }

    await recordAudit(
      {
        actor: adminId,
        action: 'fee.confirmed',
        entityType: 'management_fee',
        entityId: fee._id,
        group: group._id,
        before: { feeStatus: 'pending', groupStatus: 'draft' },
        after: { feeStatus: 'confirmed', groupStatus: 'awaiting_members', invitesEnabled: true },
        correlationId
      },
      session
    )
    await notify(
      [group.owner!],
      {
        type: 'fee.confirmed',
        title: 'Platform fee confirmed',
        body: `Your platform fee for "${group.name}" is confirmed. You can now invite members.`,
        data: { groupId: String(group._id), link: `/groups/${group._id}` }
      },
      session
    )
    return { fee: toFeeDto(fee), changed: true }
  })
}

export async function rejectFee(feeId: string, adminId: string, reason: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const fee = await ManagementFee.findOneAndUpdate(
      { _id: feeId, status: 'pending' },
      { $set: { status: 'rejected', verifiedBy: adminId, verifiedAt: new Date(), rejectionReason: reason } },
      { returnDocument: 'after', session }
    )
    if (!fee) {
      const exists = await ManagementFee.exists({ _id: feeId }).session(session)
      throw exists ? conflict('Only a reported (pending) fee can be rejected.') : notFound('Fee record not found.')
    }

    const group = await Group.findOneAndUpdate(
      { _id: fee.group, status: 'draft' },
      { $set: { feeStatus: 'rejected' } },
      { returnDocument: 'after', session }
    )

    await recordAudit(
      {
        actor: adminId,
        action: 'fee.rejected',
        entityType: 'management_fee',
        entityId: fee._id,
        group: fee.group ?? undefined,
        before: { feeStatus: 'pending' },
        after: { feeStatus: 'rejected' },
        reason,
        correlationId
      },
      session
    )
    if (group?.owner) {
      await notify(
        [group.owner],
        {
          type: 'fee.rejected',
          title: 'Platform fee not confirmed',
          body: `We could not confirm your platform fee for "${group.name}". Reason: ${reason}`,
          data: { groupId: String(group._id), link: `/groups/${group._id}/fee` }
        },
        session
      )
    }
    return { fee: toFeeDto(fee) }
  })
}

/** Signed, short-lived link to the fee transfer screenshot — platform admins, or the group's owner/admins. */
export async function feeEvidenceUrl(input: { feeId?: string, groupId?: string }, user: { id: string, isPlatformAdmin: boolean }, deps: { storage: Storage }) {
  let fee
  if (input.feeId) {
    if (!user.isPlatformAdmin) throw notFound('No attachment for this fee.')
    fee = await ManagementFee.findById(input.feeId).lean()
  } else {
    const { group } = await loadGroupForMember(input.groupId!, user.id, ['owner', 'admin'])
    fee = await ManagementFee.findOne({ group: group._id }).lean()
  }
  if (!fee?.evidenceKey) throw notFound('No attachment for this fee.')
  if (!deps.storage.configured) throw notFound('Attachments are not available right now.')
  return { url: await deps.storage.presignGet(fee.evidenceKey, 60) }
}
