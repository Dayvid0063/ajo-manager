// server/services/groups.ts
// Group creation and management before activation. Every state change happens
// here (never from the client), with an audit entry in the same transaction.
import { randomInt } from 'node:crypto'
import type { ClientSession, Types } from 'mongoose'
import type { MemberRole } from '#shared/constants'
import { lagosYmdToDate, toLagosYmd } from '#shared/utils/dates'
import { scheduleSummary } from '#shared/utils/schedule'
import { Group, type GroupDoc } from '../models/group'
import { GroupMember, type GroupMemberDoc } from '../models/group-member'
import { GroupRules } from '../models/group-rules'
import { AuditLog } from '../models/audit-log'
import { RuleAcceptance } from '../models/rule-acceptance'
import { User } from '../models/user'
import { withTransaction } from '../utils/db'
import { conflict, forbidden, notFound } from '../utils/errors'
import { hasGroupRole, isApprovedMember } from '../utils/policy'
import { recordAudit } from './audit'
import { notify } from './notifications'

type GroupWithId = GroupDoc & { _id: Types.ObjectId, createdAt?: Date }
type MemberWithId = GroupMemberDoc & { _id: Types.ObjectId }

export interface CreateGroupInput {
  name: string
  description?: string
  contributionAmount: number
  frequency: 'weekly' | 'monthly'
  startDate: string
  plannedMemberCount: number
  recipientContributes: boolean
  positionMethod: string
  recipientCanConfirm: boolean
  rules: string
}

// ── Invite codes ───────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateInviteCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/** The reference the owner puts in the fee transfer narration. */
export function paymentReferenceFor(inviteCode: string) {
  return `AJO-${inviteCode}`
}

function isDuplicateKey(error: unknown, field: string) {
  const err = error as { code?: number, keyPattern?: Record<string, unknown> }
  return err?.code === 11000 && !!err.keyPattern && field in err.keyPattern
}

// ── Access ────────────────────────────────────────────────────────────────

/**
 * Load a group the user belongs to (approved membership). Non-members get
 * 404 so group existence isn't leaked; members without the role get 403.
 */
export async function loadGroupForMember(groupId: string, userId: string, roles?: readonly MemberRole[], session?: ClientSession) {
  // Sequential on purpose: operations inside one transaction must not run in parallel
  const group = await Group.findById(groupId).session(session ?? null)
  const membership = await GroupMember.findOne({ group: groupId, user: userId }).session(session ?? null)
  if (!group || !isApprovedMember(membership)) {
    throw notFound('Group not found.')
  }
  if (roles && !hasGroupRole(membership, roles)) {
    throw forbidden()
  }
  return { group, membership }
}

// ── DTOs ──────────────────────────────────────────────────────────────────

export function toGroupDto(group: GroupWithId, membership?: Pick<MemberWithId, 'role'> | null) {
  const role = membership?.role ?? null
  const canManage = role === 'owner' || role === 'admin'
  const startDate = group.startDate ? toLagosYmd(group.startDate) : ''
  const frequency = (group.frequency ?? 'monthly') as 'weekly' | 'monthly'
  return {
    id: String(group._id),
    name: group.name ?? '',
    description: group.description ?? '',
    status: group.status ?? 'draft',
    feeStatus: group.feeStatus ?? 'unpaid',
    contributionAmount: group.contributionAmount ?? 0,
    frequency,
    startDate,
    plannedMemberCount: group.plannedMemberCount ?? 0,
    recipientContributes: group.recipientContributes === true,
    recipientCanConfirm: group.recipientCanConfirm !== false,
    positionMethod: group.positionMethod ?? 'admin_assigns',
    invitesEnabled: group.invitesEnabled === true,
    // Invite code only for managers, and only once invites are enabled
    inviteCode: canManage && group.invitesEnabled ? group.inviteCode ?? null : null,
    summary: startDate
      ? scheduleSummary({
          contributionAmount: group.contributionAmount ?? 0,
          memberCount: group.plannedMemberCount ?? 0,
          recipientContributes: group.recipientContributes === true,
          frequency,
          startDate
        })
      : null,
    approvedMemberCount: group.approvedMemberCount ?? 1,
    myRole: role,
    canManage,
    isOwner: role === 'owner',
    createdAt: group.createdAt ?? null,
    activatedAt: group.activatedAt ?? null,
    cancelledAt: group.cancelledAt ?? null
  }
}

export type GroupDto = ReturnType<typeof toGroupDto>

// ── Queries ───────────────────────────────────────────────────────────────

export async function listMyGroups(userId: string) {
  const memberships = await GroupMember.find({ user: userId, status: { $in: ['approved', 'pending'] } }).lean()
  const groups = await Group.find({ _id: { $in: memberships.map(m => m.group) } })
    .sort({ createdAt: -1 })
    .lean()
  const byGroup = new Map(memberships.map(m => [String(m.group), m]))
  const items = []
  const pending = []
  for (const group of groups) {
    const membership = byGroup.get(String(group._id))
    if (membership?.status === 'approved') {
      items.push(toGroupDto(group, membership))
    } else {
      // Applicants only see a limited summary (brief §16)
      pending.push({ name: group.name ?? '', inviteCode: group.inviteCode ?? '', requestedAt: membership?.updatedAt ?? null })
    }
  }
  return { items, pending }
}

export async function getGroupDetail(groupId: string, userId: string) {
  const { group, membership } = await loadGroupForMember(groupId, userId)
  const [rules, memberCount] = await Promise.all([
    GroupRules.findOne({ group: group._id }).sort({ version: -1 }).lean(),
    GroupMember.countDocuments({ group: group._id, status: 'approved' })
  ])
  const rulesAccepted = rules
    ? !!(await RuleAcceptance.exists({ group: group._id, member: membership._id, ruleVersion: rules.version }))
    : false
  return {
    group: toGroupDto(group, membership),
    rules: rules ? { version: rules.version ?? 1, body: rules.body ?? '', publishedAt: rules.publishedAt ?? null } : null,
    memberCount,
    // The caller's own to-dos
    me: {
      memberId: String(membership._id),
      role: membership.role ?? 'member',
      position: membership.position ?? null,
      positionAccepted: !!membership.positionAcceptedAt,
      rulesAccepted
    }
  }
}

// ── Commands ──────────────────────────────────────────────────────────────

export async function createGroup(ownerId: string, input: CreateGroupInput, correlationId?: string) {
  // Retry on the (very unlikely) invite-code collision — the unique index decides
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await withTransaction(async (session) => {
        const now = new Date()
        const [group] = await Group.create(
          [
            {
              name: input.name,
              description: input.description ?? '',
              owner: ownerId,
              contributionAmount: input.contributionAmount,
              frequency: input.frequency,
              startDate: lagosYmdToDate(input.startDate),
              plannedMemberCount: input.plannedMemberCount,
              recipientContributes: input.recipientContributes,
              positionMethod: input.positionMethod,
              recipientCanConfirm: input.recipientCanConfirm,
              status: 'draft',
              feeStatus: 'unpaid',
              inviteCode: generateInviteCode(),
              invitesEnabled: false,
              approvedMemberCount: 1
            }
          ],
          { session }
        )
        if (!group) throw new Error('Group was not created')

        // The owner is a participating member (assumption 1 in docs/architecture.md)
        await GroupMember.create(
          [{ group: group._id, user: ownerId, role: 'owner', status: 'approved', joinedAt: now, approvedBy: ownerId }],
          { session }
        )
        await GroupRules.create(
          [{ group: group._id, version: 1, body: input.rules, publishedAt: now, publishedBy: ownerId }],
          { session }
        )

        await recordAudit(
          {
            actor: ownerId,
            action: 'group.created',
            entityType: 'group',
            entityId: group._id,
            group: group._id,
            after: { ...input, rules: undefined, status: 'draft' },
            correlationId
          },
          session
        )
        await recordAudit(
          { actor: ownerId, action: 'rules.published', entityType: 'group_rules', entityId: group._id, group: group._id, after: { version: 1 }, correlationId },
          session
        )
        return toGroupDto(group, { role: 'owner' })
      })
    } catch (error) {
      if (isDuplicateKey(error, 'inviteCode') && attempt < 4) continue
      throw error
    }
  }
  throw new Error('Could not generate a unique invite code')
}

const INFO_FIELDS = ['name', 'description'] as const
const DRAFT_ONLY_FIELDS = [
  'contributionAmount',
  'frequency',
  'startDate',
  'plannedMemberCount',
  'recipientContributes',
  'positionMethod',
  'recipientCanConfirm'
] as const

type UpdateGroupInput = Partial<Omit<CreateGroupInput, 'rules'>>

export async function updateGroup(groupId: string, actorId: string, input: UpdateGroupInput, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, actorId, ['owner'], session)
    const status = group.status ?? 'draft'

    if (!['draft', 'awaiting_members'].includes(status)) {
      throw conflict('Settings can no longer be changed for this group.')
    }
    const touchesDraftOnly = DRAFT_ONLY_FIELDS.some(field => input[field] !== undefined)
    if (touchesDraftOnly && status !== 'draft') {
      throw conflict('Contribution and payout settings are locked once the platform fee is verified.')
    }

    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    for (const field of [...INFO_FIELDS, ...DRAFT_ONLY_FIELDS]) {
      const next = input[field]
      if (next === undefined) continue
      const current = field === 'startDate' ? (group.startDate ? toLagosYmd(group.startDate) : undefined) : group[field]
      if (current === next) continue
      before[field] = current
      after[field] = next
      group.set(field, field === 'startDate' ? lagosYmdToDate(next as string) : next)
    }

    if (Object.keys(after).length) {
      await group.save({ session })
      await recordAudit(
        { actor: actorId, action: 'group.settings_changed', entityType: 'group', entityId: group._id, group: group._id, before, after, correlationId },
        session
      )
    }
    return toGroupDto(group, membership)
  })
}

export async function saveRules(groupId: string, actorId: string, body: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group } = await loadGroupForMember(groupId, actorId, ['owner', 'admin'], session)
    const status = group.status ?? 'draft'
    if (!['draft', 'awaiting_members'].includes(status)) {
      throw conflict('Rules can no longer be changed for this group.')
    }

    const latest = await GroupRules.findOne({ group: group._id }).sort({ version: -1 }).session(session)
    if (latest && latest.body === body) {
      return { version: latest.version ?? 1, body, publishedAt: latest.publishedAt ?? null }
    }

    const now = new Date()
    let version: number
    if (status === 'draft' && latest) {
      // Nobody else can see a draft yet, so edit the current version in place
      latest.body = body
      latest.publishedAt = now
      latest.publishedBy = actorId as unknown as Types.ObjectId
      await latest.save({ session })
      version = latest.version ?? 1
    } else {
      // Members may have accepted the old version — publish a new one
      version = (latest?.version ?? 0) + 1
      await GroupRules.create([{ group: group._id, version, body, publishedAt: now, publishedBy: actorId }], { session })
    }

    await recordAudit(
      { actor: actorId, action: 'rules.published', entityType: 'group_rules', entityId: group._id, group: group._id, after: { version }, correlationId },
      session
    )
    if (status === 'awaiting_members') {
      const members = await GroupMember.find({ group: group._id, status: 'approved', user: { $ne: actorId } }).select('user').session(session).lean()
      await notify(
        members.map(m => m.user!),
        {
          type: 'rules.updated',
          title: 'Group rules updated',
          body: `The rules for "${group.name}" changed. Please read and accept the new version.`,
          data: { groupId: String(group._id), link: `/groups/${group._id}/rules` }
        },
        session
      )
    }
    return { version, body, publishedAt: now }
  })
}

export async function cancelGroup(groupId: string, actorId: string, reason: string, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, actorId, ['owner'], session)
    const before = group.status ?? 'draft'
    // Conditional update: only cancel from a state that allows it, even under races
    const updated = await Group.findOneAndUpdate(
      { _id: group._id, status: { $in: ['draft', 'awaiting_members'] } },
      { $set: { status: 'cancelled', invitesEnabled: false, cancelledAt: new Date() } },
      { returnDocument: 'after', session }
    )
    if (!updated) {
      throw conflict('Only groups that have not started can be cancelled.')
    }
    await recordAudit(
      {
        actor: actorId,
        action: 'group.cancelled',
        entityType: 'group',
        entityId: group._id,
        group: group._id,
        before: { status: before },
        after: { status: 'cancelled' },
        reason,
        correlationId
      },
      session
    )
    return toGroupDto(updated, membership)
  })
}

// ── Activity ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'group.created': 'created the group',
  'group.settings_changed': 'changed the group settings',
  'group.cancelled': 'cancelled the group',
  'rules.published': 'published the group rules',
  'fee.reported': 'reported the platform fee payment',
  'fee.confirmed': 'confirmed the platform fee',
  'fee.rejected': 'could not confirm the platform fee',
  'membership.requested': 'asked to join',
  'membership.approved': 'approved a member',
  'membership.rejected': 'declined a join request',
  'membership.removed': 'removed a member',
  'role.assigned': 'changed a member’s role',
  'rules.accepted': 'accepted the rules',
  'position.assigned': 'set a payout position',
  'position.accepted': 'accepted their payout position',
  'positions.drawn': 'ran the random payout draw',
  'group.activated': 'started the group'
}

export async function groupActivity(groupId: string, userId: string, input: { page: number, limit: number }) {
  await loadGroupForMember(groupId, userId, ['owner', 'admin'])
  const filter = { group: groupId }
  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean(),
    AuditLog.countDocuments(filter)
  ])
  const actors = await User.find({ _id: { $in: entries.map(e => e.actor).filter(Boolean) } })
    .select('name isPlatformAdmin')
    .lean()
  const actorById = new Map(actors.map(a => [String(a._id), a]))

  return {
    items: entries.map((entry) => {
      const actor = entry.actor ? actorById.get(String(entry.actor)) : null
      return {
        id: String(entry._id),
        action: entry.action,
        // Platform staff are shown by role, not by name
        actorName: actor ? (actor.isPlatformAdmin && entry.action?.startsWith('fee.') && entry.action !== 'fee.reported' ? 'Ajo Manager' : actor.name || 'A member') : 'System',
        summary: ACTION_LABELS[entry.action ?? ''] ?? entry.action,
        reason: entry.reason ?? '',
        createdAt: entry.createdAt
      }
    }),
    total,
    page: input.page,
    limit: input.limit
  }
}
