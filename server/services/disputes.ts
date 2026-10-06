// server/services/disputes.ts
// Basic disputes (brief §13): a member raises a problem, the group's
// owner/admins (and platform admins) discuss it and record an outcome.
// Visible only to the person who opened it, the group's owner/admins and platform admins.
import type { Types } from 'mongoose'
import { Dispute, type DisputeDoc } from '../models/dispute'
import { Group } from '../models/group'
import { GroupMember } from '../models/group-member'
import { Obligation } from '../models/obligation'
import { Round } from '../models/round'
import { User } from '../models/user'
import { withTransaction } from '../utils/db'
import { conflict, forbidden, notFound } from '../utils/errors'
import { recordAudit } from './audit'
import { loadGroupForMember } from './groups'
import { managerUserIds } from './membership'
import { notify } from './notifications'

export interface Actor {
  id: string
  isPlatformAdmin: boolean
}

type DisputeWithId = DisputeDoc & { _id: Types.ObjectId, createdAt?: Date }

const OPEN_STATES = ['open', 'under_review']

export const CATEGORY_LABELS: Record<string, string> = {
  payment_not_confirmed: 'Payment made but not confirmed',
  wrong_amount: 'Wrong amount',
  wrong_recipient_details: 'Wrong recipient details',
  duplicate_record: 'Duplicate record',
  member_misconduct: 'Member misconduct',
  other: 'Something else'
}

/** Access + the caller's role in this dispute. Non-participants get 404. */
async function loadForActor(disputeId: string, actor: Actor) {
  const dispute = await Dispute.findById(disputeId)
  if (!dispute) throw notFound('Dispute not found.')
  const membership = await GroupMember.findOne({ group: dispute.group, user: actor.id, status: 'approved' }).lean()
  const isManager = !!membership && ['owner', 'admin'].includes(membership.role ?? '')
  const isOpener = String(dispute.opener) === actor.id
  if (!actor.isPlatformAdmin && !isManager && !isOpener) throw notFound('Dispute not found.')
  return { dispute, isManager, isOpener }
}

function roleOf(actor: Actor, isManager: boolean) {
  return actor.isPlatformAdmin && !isManager ? 'platform' : isManager ? 'manager' : 'member'
}

/** Everyone involved, minus the person acting. */
async function participants(dispute: { group?: Types.ObjectId | null, opener?: Types.ObjectId | null }, exceptUserId: string) {
  const ids = new Set((await managerUserIds(dispute.group!)).map(String))
  ids.add(String(dispute.opener))
  ids.delete(exceptUserId)
  return [...ids]
}

async function toDisputeDto(dispute: DisputeWithId, actor: Actor, flags: { isManager: boolean, isOpener: boolean }) {
  const authorIds = [dispute.opener, dispute.resolvedBy, ...dispute.messages.map(m => m.author)].filter(Boolean)
  const [users, group, obligation] = await Promise.all([
    User.find({ _id: { $in: authorIds } }).select('name').lean(),
    Group.findById(dispute.group).select('name').lean(),
    dispute.obligation ? Obligation.findById(dispute.obligation).lean() : null
  ])
  const nameById = new Map(users.map(u => [String(u._id), u.name || 'Member']))
  let payment = null
  if (obligation) {
    const [round, contributor] = await Promise.all([
      Round.findById(obligation.round).select('index').lean(),
      User.findById(obligation.contributorUser).select('name').lean()
    ])
    payment = {
      obligationId: String(obligation._id),
      roundIndex: round?.index ?? 0,
      contributorName: contributor?.name || 'Member',
      amount: obligation.expectedAmount ?? 0,
      status: obligation.status ?? 'pending'
    }
  }
  const isOpen = OPEN_STATES.includes(dispute.status ?? 'open')
  const canAct = actor.isPlatformAdmin || flags.isManager
  return {
    id: String(dispute._id),
    group: { id: String(dispute.group), name: group?.name ?? '' },
    category: dispute.category ?? 'other',
    categoryLabel: CATEGORY_LABELS[dispute.category ?? 'other'] ?? 'Something else',
    description: dispute.description ?? '',
    status: dispute.status ?? 'open',
    openerName: nameById.get(String(dispute.opener)) ?? 'Member',
    isMine: flags.isOpener,
    payment,
    messages: dispute.messages.map(m => ({
      id: String(m._id),
      authorName: m.authorRole === 'platform' ? 'Ajo Manager support' : nameById.get(String(m.author)) ?? 'Member',
      authorRole: m.authorRole ?? 'member',
      isMine: String(m.author) === actor.id,
      body: m.body ?? '',
      createdAt: m.createdAt ?? null
    })),
    resolution: dispute.resolution ?? '',
    resolvedByName: dispute.resolvedBy ? nameById.get(String(dispute.resolvedBy)) ?? '' : '',
    resolvedAt: dispute.resolvedAt ?? null,
    createdAt: dispute.createdAt ?? null,
    canReply: isOpen,
    // The person who raised it can't also decide it (platform admins can)
    canResolve: isOpen && canAct && (!flags.isOpener || actor.isPlatformAdmin)
  }
}

export async function openDispute(
  groupId: string,
  userId: string,
  input: { category: string, description: string, obligationId?: string },
  correlationId?: string
) {
  return withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, userId, undefined, session)
    if (['draft', 'cancelled'].includes(group.status ?? '')) throw conflict('Disputes can only be raised in a group that has members.')

    let obligation = null
    if (input.obligationId) {
      obligation = await Obligation.findOne({ _id: input.obligationId, group: group._id }).session(session)
      if (!obligation) throw notFound('Payment not found in this group.')
      const round = await Round.findById(obligation.round).select('recipientUser').session(session).lean()
      const involved = String(obligation.contributorUser) === userId || String(round?.recipientUser) === userId || ['owner', 'admin'].includes(membership.role ?? '')
      if (!involved) throw forbidden('You can only raise a dispute about a payment you are part of.')
    }

    const [dispute] = await Dispute.create(
      [{
        group: group._id,
        obligation: obligation?._id,
        round: obligation?.round,
        opener: userId,
        category: input.category,
        description: input.description,
        status: 'open'
      }],
      { session }
    )
    await recordAudit(
      {
        actor: userId,
        action: 'dispute.created',
        entityType: 'dispute',
        entityId: dispute!._id,
        group: group._id,
        after: { category: input.category, obligation: input.obligationId ?? null },
        correlationId
      },
      session
    )
    const opener = await User.findById(userId).select('name').session(session).lean()
    const managers = (await managerUserIds(group._id, session)).map(String).filter(id => id !== userId)
    await notify(
      managers,
      {
        type: 'dispute.opened',
        title: 'New dispute raised',
        body: `${opener?.name || 'A member'} raised "${CATEGORY_LABELS[input.category]}" in "${group.name}".`,
        data: { groupId: String(group._id), disputeId: String(dispute!._id), link: `/disputes/${dispute!._id}` }
      },
      session
    )
    return { id: String(dispute!._id) }
  })
}

export async function getDispute(disputeId: string, actor: Actor) {
  const { dispute, isManager, isOpener } = await loadForActor(disputeId, actor)
  return toDisputeDto(dispute.toObject() as DisputeWithId, actor, { isManager, isOpener })
}

/** Owner/admins see every dispute in the group; members see the ones they raised. */
export async function listGroupDisputes(groupId: string, userId: string) {
  const { group, membership } = await loadGroupForMember(groupId, userId)
  const manager = ['owner', 'admin'].includes(membership.role ?? '')
  const disputes = await Dispute.find({ group: group._id, ...(manager ? {} : { opener: userId }) }).sort({ createdAt: -1 }).lean()
  const openers = await User.find({ _id: { $in: disputes.map(d => d.opener) } }).select('name').lean()
  const nameById = new Map(openers.map(u => [String(u._id), u.name || 'Member']))
  return {
    items: disputes.map(d => ({
      id: String(d._id),
      categoryLabel: CATEGORY_LABELS[d.category ?? 'other'] ?? 'Something else',
      status: d.status ?? 'open',
      openerName: nameById.get(String(d.opener)) ?? 'Member',
      isMine: String(d.opener) === userId,
      messages: d.messages.length,
      createdAt: d.createdAt ?? null
    }))
  }
}

export async function addDisputeMessage(disputeId: string, actor: Actor, body: string) {
  const { dispute, isManager, isOpener } = await loadForActor(disputeId, actor)
  if (!OPEN_STATES.includes(dispute.status ?? 'open')) throw conflict('This dispute is closed.')

  const role = roleOf(actor, isManager)
  const update: Record<string, unknown> = { $push: { messages: { author: actor.id, authorRole: role, body, createdAt: new Date() } } }
  // A reply from someone who can decide moves it into review
  if (dispute.status === 'open' && (isManager || actor.isPlatformAdmin) && !isOpener) {
    update.$set = { status: 'under_review', assignee: actor.id }
  }
  const updated = await Dispute.findOneAndUpdate({ _id: dispute._id, status: { $in: OPEN_STATES } }, update, { returnDocument: 'after' })
  if (!updated) throw conflict('This dispute is closed.')

  const group = await Group.findById(dispute.group).select('name').lean()
  await notify(await participants(dispute, actor.id), {
    type: 'dispute.updated',
    title: 'New message on a dispute',
    body: `There's a new message on a dispute in "${group?.name}".`,
    data: { groupId: String(dispute.group), disputeId: String(dispute._id), link: `/disputes/${dispute._id}` }
  })
  return toDisputeDto(updated.toObject() as DisputeWithId, actor, { isManager, isOpener })
}

export async function resolveDispute(
  disputeId: string,
  actor: Actor,
  input: { outcome: 'resolved' | 'rejected', resolution: string },
  correlationId?: string
) {
  return withTransaction(async (session) => {
    const { dispute, isManager, isOpener } = await loadForActor(disputeId, actor)
    if (!actor.isPlatformAdmin && !isManager) throw forbidden('Only the group owner, an admin or Ajo Manager support can decide a dispute.')
    if (isOpener && !actor.isPlatformAdmin) throw forbidden('You raised this dispute, so someone else must decide it.')

    const updated = await Dispute.findOneAndUpdate(
      { _id: dispute._id, status: { $in: OPEN_STATES } },
      { $set: { status: input.outcome, resolution: input.resolution, resolvedBy: actor.id, resolvedAt: new Date() } },
      { returnDocument: 'after', session }
    )
    if (!updated) throw conflict('This dispute is already closed.')

    await recordAudit(
      {
        actor: actor.id,
        action: input.outcome === 'resolved' ? 'dispute.resolved' : 'dispute.rejected',
        entityType: 'dispute',
        entityId: dispute._id,
        group: dispute.group!,
        before: { status: dispute.status },
        after: { status: input.outcome, decidedAs: roleOf(actor, isManager) },
        reason: input.resolution,
        correlationId
      },
      session
    )
    const group = await Group.findById(dispute.group).select('name').session(session).lean()
    await notify(
      await participants(dispute, actor.id),
      {
        type: 'dispute.updated',
        title: input.outcome === 'resolved' ? 'Dispute resolved' : 'Dispute closed',
        body: `A dispute in "${group?.name}" was ${input.outcome === 'resolved' ? 'resolved' : 'closed without changes'}: ${input.resolution}`,
        data: { groupId: String(dispute.group), disputeId: String(dispute._id), link: `/disputes/${dispute._id}` }
      },
      session
    )
    return toDisputeDto(updated.toObject() as DisputeWithId, actor, { isManager, isOpener })
  })
}

/** Platform admin queue across all groups. */
export async function listAllDisputes(input: { status: string, page: number, limit: number }) {
  const filter = input.status === 'all' ? {} : input.status === 'active' ? { status: { $in: OPEN_STATES } } : { status: input.status }
  const [disputes, total] = await Promise.all([
    Dispute.find(filter).sort({ createdAt: input.status === 'active' ? 1 : -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
    Dispute.countDocuments(filter)
  ])
  const [groups, openers] = await Promise.all([
    Group.find({ _id: { $in: disputes.map(d => d.group) } }).select('name').lean(),
    User.find({ _id: { $in: disputes.map(d => d.opener) } }).select('name email').lean()
  ])
  const groupById = new Map(groups.map(g => [String(g._id), g.name ?? '']))
  const openerById = new Map(openers.map(u => [String(u._id), u]))
  return {
    items: disputes.map(d => ({
      id: String(d._id),
      groupName: groupById.get(String(d.group)) ?? '',
      categoryLabel: CATEGORY_LABELS[d.category ?? 'other'] ?? 'Something else',
      status: d.status ?? 'open',
      openerName: openerById.get(String(d.opener))?.name || 'Member',
      openerEmail: openerById.get(String(d.opener))?.email ?? '',
      messages: d.messages.length,
      createdAt: d.createdAt ?? null
    })),
    total,
    page: input.page,
    limit: input.limit
  }
}

/** Open disputes about a payment — shown as "In dispute" (derived, nothing stored on the payment). */
export async function openDisputeCountForObligation(obligationId: string) {
  return Dispute.countDocuments({ obligation: obligationId, status: { $in: OPEN_STATES } })
}
