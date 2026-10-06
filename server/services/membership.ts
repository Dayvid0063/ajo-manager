// server/services/membership.ts
// Joining a group, approvals, roles, rule acceptance and payout positions —
// everything that happens while a group is `awaiting_members`.
import { randomInt } from 'node:crypto'
import type { ClientSession, Types } from 'mongoose'
import { toLagosYmd } from '#shared/utils/dates'
import { payoutPerRoundKobo } from '#shared/utils/schedule'
import { Group } from '../models/group'
import { GroupMember } from '../models/group-member'
import { GroupRules } from '../models/group-rules'
import { RuleAcceptance } from '../models/rule-acceptance'
import { User } from '../models/user'
import { withTransaction } from '../utils/db'
import { conflict, forbidden, notFound } from '../utils/errors'
import { recordAudit } from './audit'
import { loadGroupForMember } from './groups'
import { notify } from './notifications'

const MANAGERS = ['owner', 'admin'] as const

function isDuplicateKey(error: unknown) {
  return (error as { code?: number })?.code === 11000
}

/** Turn a unique-index violation on (group, position) into a friendly 409. */
async function positionGuard<T>(position: number | null, work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict(`Position ${position} is already taken. Choose another one.`)
    throw error
  }
}

function requireStatus(group: { status?: string | null }, status: string, message: string) {
  if (group.status !== status) throw conflict(message)
}

const NOT_ACCEPTING = 'This group is not accepting changes to members right now.'

export async function managerUserIds(groupId: Types.ObjectId | string, session?: ClientSession) {
  const managers = await GroupMember.find({ group: groupId, status: 'approved', role: { $in: MANAGERS } })
    .select('user')
    .session(session ?? null)
    .lean()
  return managers.map(m => m.user!)
}

async function latestRuleVersion(groupId: Types.ObjectId | string, session?: ClientSession) {
  const latest = await GroupRules.findOne({ group: groupId }).sort({ version: -1 }).select('version').session(session ?? null).lean()
  return latest?.version ?? 0
}

// ── Joining ───────────────────────────────────────────────────────────────

/** The limited summary anyone with the invite code can see (brief §7, §16). */
export async function getJoinSummary(code: string, userId: string | null) {
  const group = await Group.findOne({ inviteCode: code }).lean()
  if (!group || !['awaiting_members', 'active', 'completed'].includes(group.status ?? '')) {
    throw notFound('That invite code is not valid. Check it with the person who invited you.')
  }
  const [owner, membership] = await Promise.all([
    User.findById(group.owner).select('name').lean(),
    userId ? GroupMember.findOne({ group: group._id, user: userId }).lean() : null
  ])
  const approved = group.approvedMemberCount ?? 1
  const planned = group.plannedMemberCount ?? 0
  return {
    code,
    groupId: membership?.status === 'approved' ? String(group._id) : null,
    name: group.name ?? '',
    description: group.description ?? '',
    ownerName: owner?.name ?? '',
    contributionAmount: group.contributionAmount ?? 0,
    frequency: group.frequency ?? 'monthly',
    startDate: group.startDate ? toLagosYmd(group.startDate) : '',
    plannedMemberCount: planned,
    approvedMemberCount: approved,
    recipientContributes: group.recipientContributes === true,
    payoutPerRound: payoutPerRoundKobo(group.contributionAmount ?? 0, planned, group.recipientContributes === true),
    positionMethod: group.positionMethod ?? 'admin_assigns',
    acceptingMembers: group.status === 'awaiting_members' && group.invitesEnabled === true && approved < planned,
    myStatus: membership?.status ?? null
  }
}

export async function requestToJoin(code: string, userId: string, correlationId?: string) {
  try {
    return await withTransaction(async (session) => {
      const group = await Group.findOne({ inviteCode: code }).session(session)
      if (!group || !['awaiting_members', 'active', 'completed'].includes(group.status ?? '')) {
        throw notFound('That invite code is not valid.')
      }
      if (group.status !== 'awaiting_members' || !group.invitesEnabled) {
        throw conflict('This group has already started and cannot take new members.')
      }
      if ((group.approvedMemberCount ?? 1) >= (group.plannedMemberCount ?? 0)) {
        throw conflict('This group is full.')
      }

      const existing = await GroupMember.findOne({ group: group._id, user: userId }).session(session)
      if (existing?.status === 'approved') throw conflict('You are already a member of this group.')
      if (existing?.status === 'pending') return { status: 'pending' as const, changed: false }

      let memberId: Types.ObjectId
      if (existing) {
        existing.status = 'pending'
        existing.role = 'member'
        await existing.save({ session })
        memberId = existing._id
      } else {
        const [created] = await GroupMember.create([{ group: group._id, user: userId, role: 'member', status: 'pending' }], { session })
        memberId = created!._id
      }

      const user = await User.findById(userId).select('name').session(session).lean()
      await recordAudit(
        { actor: userId, action: 'membership.requested', entityType: 'group_member', entityId: memberId, group: group._id, correlationId },
        session
      )
      await notify(
        await managerUserIds(group._id, session),
        {
          type: 'membership.requested',
          title: 'New request to join',
          body: `${user?.name || 'Someone'} wants to join "${group.name}".`,
          data: { groupId: String(group._id), link: `/groups/${group._id}/members` }
        },
        session
      )
      return { status: 'pending' as const, changed: true }
    })
  } catch (error) {
    // Two simultaneous requests from the same user: the unique (group, user) index wins
    if (isDuplicateKey(error)) return { status: 'pending' as const, changed: false }
    throw error
  }
}

// ── Listing ───────────────────────────────────────────────────────────────

export async function listMembers(groupId: string, userId: string) {
  const { group, membership } = await loadGroupForMember(groupId, userId)
  const canManage = MANAGERS.includes(membership.role as typeof MANAGERS[number])
  const version = await latestRuleVersion(group._id)

  const statuses = canManage ? ['approved', 'pending'] : ['approved']
  const members = await GroupMember.find({ group: group._id, status: { $in: statuses } }).sort({ createdAt: 1 }).lean()
  const [users, acceptances] = await Promise.all([
    User.find({ _id: { $in: members.map(m => m.user) } }).select('name email phone').lean(),
    RuleAcceptance.find({ group: group._id, ruleVersion: version }).select('member').lean()
  ])
  const userById = new Map(users.map(u => [String(u._id), u]))
  const accepted = new Set(acceptances.map(a => String(a.member)))

  const toDto = (m: typeof members[number]) => {
    const user = userById.get(String(m.user))
    return {
      memberId: String(m._id),
      userId: String(m.user),
      name: user?.name || 'New member',
      // Contact details only for the people running the group
      email: canManage ? user?.email ?? '' : undefined,
      phone: canManage ? user?.phone ?? '' : undefined,
      role: m.role ?? 'member',
      status: m.status ?? 'pending',
      position: m.position ?? null,
      positionAccepted: !!m.positionAcceptedAt,
      rulesAccepted: accepted.has(String(m._id)),
      requestedAt: m.createdAt ?? null,
      joinedAt: m.joinedAt ?? null,
      isMe: String(m.user) === userId
    }
  }

  const approved = members.filter(m => m.status === 'approved').map(toDto)
  const taken = new Set(approved.map(m => m.position).filter(p => p !== null))
  const planned = group.plannedMemberCount ?? 0

  return {
    members: approved.sort((a, b) => (a.position ?? 999) - (b.position ?? 999)),
    pending: canManage ? members.filter(m => m.status === 'pending').map(toDto) : [],
    ruleVersion: version,
    openPositions: Array.from({ length: planned }, (_, i) => i + 1).filter(p => !taken.has(p)),
    positionMethod: group.positionMethod ?? 'admin_assigns',
    plannedMemberCount: planned
  }
}

// ── Approvals ─────────────────────────────────────────────────────────────

async function loadTarget(groupId: Types.ObjectId | string, memberId: string, session: ClientSession) {
  const target = await GroupMember.findOne({ _id: memberId, group: groupId }).session(session)
  if (!target) throw notFound('Member not found.')
  return target
}

export async function approveMember(groupId: string, actorId: string, memberId: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, actorId, MANAGERS, session)
    requireStatus(group, 'awaiting_members', NOT_ACCEPTING)
    const target = await loadTarget(group._id, memberId, session)
    if (target.status !== 'pending') throw conflict('This request has already been handled.')

    // Backfill the counter for groups created before it existed
    if (group.approvedMemberCount == null) {
      const count = await GroupMember.countDocuments({ group: group._id, status: 'approved' }).session(session)
      await Group.updateOne({ _id: group._id }, { $set: { approvedMemberCount: count } }, { session })
    }
    // Conditional increment: also a write on the group document, so two
    // simultaneous approvals conflict and the second re-checks the count
    const updated = await Group.findOneAndUpdate(
      { _id: group._id, status: 'awaiting_members', $expr: { $lt: ['$approvedMemberCount', '$plannedMemberCount'] } },
      { $inc: { approvedMemberCount: 1 } },
      { returnDocument: 'after', session }
    )
    if (!updated) throw conflict(`The group is full (${group.plannedMemberCount} members).`)

    target.status = 'approved'
    target.joinedAt = new Date()
    target.approvedBy = actorId as unknown as Types.ObjectId
    await target.save({ session })

    await recordAudit(
      { actor: actorId, action: 'membership.approved', entityType: 'group_member', entityId: target._id, group: group._id, after: { status: 'approved' }, correlationId },
      session
    )
    await notify(
      [target.user!],
      {
        type: 'membership.approved',
        title: 'You\'re in!',
        body: `Your request to join "${group.name}" was approved. Please read and accept the group rules.`,
        data: { groupId: String(group._id), link: `/groups/${group._id}` }
      },
      session
    )
    if ((updated.approvedMemberCount ?? 0) >= (updated.plannedMemberCount ?? 0)) {
      await notify(
        [group.owner!],
        {
          type: 'group.full',
          title: 'Everyone has joined',
          body: `"${group.name}" has all ${group.plannedMemberCount} members. Next: payout positions and rules.`,
          data: { groupId: String(group._id), link: `/groups/${group._id}` }
        },
        session
      )
    }
    return { status: 'approved' }
  })
}

export async function rejectMember(groupId: string, actorId: string, memberId: string, reason: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, actorId, MANAGERS, session)
    const target = await loadTarget(group._id, memberId, session)
    if (target.status !== 'pending') throw conflict('This request has already been handled.')

    target.status = 'rejected'
    await target.save({ session })
    await recordAudit(
      { actor: actorId, action: 'membership.rejected', entityType: 'group_member', entityId: target._id, group: group._id, after: { status: 'rejected' }, reason, correlationId },
      session
    )
    await notify(
      [target.user!],
      {
        type: 'membership.rejected',
        title: 'Join request not approved',
        body: `Your request to join "${group.name}" was not approved.${reason ? ` Reason: ${reason}` : ''}`,
        data: {}
      },
      session
    )
    return { status: 'rejected' }
  })
}

/** Owner removes an approved member before the group starts. */
export async function removeMember(groupId: string, actorId: string, memberId: string, reason: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, actorId, ['owner'], session)
    requireStatus(group, 'awaiting_members', 'Members can only be removed before the group starts.')
    const target = await loadTarget(group._id, memberId, session)
    if (target.status !== 'approved') throw conflict('Only approved members can be removed.')
    if (target.role === 'owner') throw forbidden('The owner cannot be removed.')

    const before = { status: target.status, role: target.role, position: target.position ?? null }
    target.status = 'removed'
    target.role = 'member'
    target.set('position', undefined)
    target.set('positionAcceptedAt', undefined)
    await target.save({ session })
    await Group.updateOne({ _id: group._id }, { $inc: { approvedMemberCount: -1 } }, { session })

    await recordAudit(
      { actor: actorId, action: 'membership.removed', entityType: 'group_member', entityId: target._id, group: group._id, before, after: { status: 'removed' }, reason, correlationId },
      session
    )
    await notify(
      [target.user!],
      { type: 'membership.removed', title: 'Removed from group', body: `You were removed from "${group.name}".${reason ? ` Reason: ${reason}` : ''}`, data: {} },
      session
    )
    return { status: 'removed' }
  })
}

export async function setMemberRole(groupId: string, actorId: string, memberId: string, role: 'admin' | 'member', correlationId?: string) {
  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, actorId, ['owner'], session)
    if (!['awaiting_members', 'active'].includes(group.status ?? '')) throw conflict('Roles can no longer be changed for this group.')
    const target = await loadTarget(group._id, memberId, session)
    if (target.status !== 'approved') throw conflict('Only approved members can be given a role.')
    if (target.role === 'owner') throw forbidden('The owner\'s role cannot be changed.')
    if (target.role === role) return { role }

    const before = { role: target.role }
    target.role = role
    await target.save({ session })
    await recordAudit(
      { actor: actorId, action: 'role.assigned', entityType: 'group_member', entityId: target._id, group: group._id, before, after: { role }, correlationId },
      session
    )
    await notify(
      [target.user!],
      {
        type: 'role.assigned',
        title: role === 'admin' ? 'You are now a group admin' : 'Your admin role was removed',
        body: role === 'admin'
          ? `You can now approve members and confirm payments in "${group.name}".`
          : `You are now a regular member of "${group.name}".`,
        data: { groupId: String(group._id), link: `/groups/${group._id}` }
      },
      session
    )
    return { role }
  })
}

// ── Rules acceptance ──────────────────────────────────────────────────────

export async function acceptRules(groupId: string, userId: string, version: number, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, userId, undefined, session)
    requireStatus(group, 'awaiting_members', 'Rules can only be accepted before the group starts.')
    const latest = await latestRuleVersion(group._id, session)
    if (version !== latest) throw conflict('The rules were updated. Please read the latest version and accept again.')

    const existing = await RuleAcceptance.findOne({ group: group._id, member: membership._id, ruleVersion: version }).session(session)
    if (existing) return { version, acceptedAt: existing.acceptedAt }

    const acceptedAt = new Date()
    await RuleAcceptance.create([{ group: group._id, member: membership._id, user: userId, ruleVersion: version, acceptedAt }], { session })
    await recordAudit(
      { actor: userId, action: 'rules.accepted', entityType: 'group_member', entityId: membership._id, group: group._id, after: { ruleVersion: version }, correlationId },
      session
    )
    return { version, acceptedAt }
  })
}

// ── Payout positions ──────────────────────────────────────────────────────

function assertPositionInRange(position: number, planned: number) {
  if (position < 1 || position > planned) throw conflict(`Choose a position between 1 and ${planned}.`)
}

/** Owner/admin sets (or clears) a member's position — method "admin_assigns". */
export async function assignPosition(groupId: string, actorId: string, memberId: string, position: number | null, correlationId?: string) {
  return positionGuard(position, () => withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, actorId, MANAGERS, session)
    requireStatus(group, 'awaiting_members', 'Positions are locked once the group starts.')
    if (group.positionMethod !== 'admin_assigns') throw conflict('In this group, positions are not assigned by admins.')
    const target = await loadTarget(group._id, memberId, session)
    if (target.status !== 'approved') throw conflict('Only approved members can have a position.')
    if (position !== null) assertPositionInRange(position, group.plannedMemberCount ?? 0)

    const before = { position: target.position ?? null }
    if ((target.position ?? null) === position) return { position }
    target.set('position', position ?? undefined)
    target.set('positionAcceptedAt', undefined) // a new position must be accepted again
    await target.save({ session })

    await recordAudit(
      { actor: actorId, action: 'position.assigned', entityType: 'group_member', entityId: target._id, group: group._id, before, after: { position }, correlationId },
      session
    )
    if (position !== null) {
      await notify(
        [target.user!],
        {
          type: 'position.assigned',
          title: 'Your payout position',
          body: `You are number ${position} in "${group.name}". Please review and accept it.`,
          data: { groupId: String(group._id), link: `/groups/${group._id}` }
        },
        session
      )
    }
    return { position }
  }))
}

/** A member picks an open slot for themselves — method "members_pick". */
export async function pickPosition(groupId: string, userId: string, position: number, correlationId?: string) {
  return positionGuard(position, () => withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, userId, undefined, session)
    requireStatus(group, 'awaiting_members', 'Positions are locked once the group starts.')
    if (group.positionMethod !== 'members_pick') throw conflict('In this group, members do not pick their own position.')
    if (membership.positionAcceptedAt) throw conflict('You already confirmed your position.')
    assertPositionInRange(position, group.plannedMemberCount ?? 0)

    const before = { position: membership.position ?? null }
    membership.position = position
    // Picking it yourself counts as accepting it
    membership.positionAcceptedAt = new Date()
    await membership.save({ session })
    await recordAudit(
      { actor: userId, action: 'position.assigned', entityType: 'group_member', entityId: membership._id, group: group._id, before, after: { position, picked: true }, correlationId },
      session
    )
    return { position }
  }))
}

/**
 * Owner runs a fair random draw — method "random" — over the members who have
 * joined so far (at least 2). It can be re-run, e.g. after more people join,
 * until any member accepts their position.
 */
export async function drawPositions(groupId: string, actorId: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, actorId, ['owner'], session)
    requireStatus(group, 'awaiting_members', 'Positions are locked once the group starts.')
    if (group.positionMethod !== 'random') throw conflict('This group does not use a random draw.')

    const members = await GroupMember.find({ group: group._id, status: 'approved' }).session(session)
    if (members.length < 2) {
      throw conflict('At least 2 members must join before the draw.')
    }
    if (members.some(m => m.positionAcceptedAt)) {
      throw conflict('Some members already accepted their positions, so the draw cannot be repeated.')
    }

    // Fisher–Yates shuffle with a cryptographic RNG
    const positions = members.map((_, i) => i + 1)
    for (let i = positions.length - 1; i > 0; i--) {
      const j = randomInt(i + 1)
      ;[positions[i], positions[j]] = [positions[j]!, positions[i]!]
    }

    // Clear first so the unique (group, position) index never sees a temporary clash
    await GroupMember.updateMany({ group: group._id, status: 'approved' }, { $unset: { position: '', positionAcceptedAt: '' } }, { session })
    for (const [i, member] of members.entries()) {
      await GroupMember.updateOne({ _id: member._id }, { $set: { position: positions[i] } }, { session })
    }

    const result = members.map((m, i) => ({ memberId: String(m._id), position: positions[i]! }))
    await recordAudit(
      { actor: actorId, action: 'positions.drawn', entityType: 'group', entityId: group._id, group: group._id, after: { positions: result }, correlationId },
      session
    )
    await notify(
      members.map(m => m.user!),
      {
        type: 'position.assigned',
        title: 'Payout positions drawn',
        body: `The random draw for "${group.name}" is done. See your position and accept it.`,
        data: { groupId: String(group._id), link: `/groups/${group._id}` }
      },
      session
    )
    return { positions: result }
  })
}

export async function acceptPosition(groupId: string, userId: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, userId, undefined, session)
    requireStatus(group, 'awaiting_members', 'Positions are locked once the group starts.')
    if (!membership.position) throw conflict('You don\'t have a payout position yet.')
    if (membership.positionAcceptedAt) return { position: membership.position }

    membership.positionAcceptedAt = new Date()
    await membership.save({ session })
    await recordAudit(
      { actor: userId, action: 'position.accepted', entityType: 'group_member', entityId: membership._id, group: group._id, after: { position: membership.position }, correlationId },
      session
    )
    return { position: membership.position }
  })
}
