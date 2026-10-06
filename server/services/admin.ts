// server/services/admin.ts
// Platform-admin read views. Deliberately READ-ONLY for group data: platform
// admins verify fees, reset passwords and decide disputes, but there is no
// route that edits contribution records, positions or schedules (brief §3).
import { AuditLog } from '../models/audit-log'
import { Dispute } from '../models/dispute'
import { Group } from '../models/group'
import { GroupMember } from '../models/group-member'
import { ManagementFee } from '../models/management-fee'
import { Obligation } from '../models/obligation'
import { Round } from '../models/round'
import { User } from '../models/user'
import { notFound } from '../utils/errors'
import { toGroupDto } from './groups'

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function adminOverview() {
  const [users, groupsByStatus, pendingFees, openDisputes] = await Promise.all([
    User.countDocuments(),
    Group.aggregate<{ _id: string, count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ManagementFee.countDocuments({ status: 'pending' }),
    Dispute.countDocuments({ status: { $in: ['open', 'under_review'] } })
  ])
  return {
    users,
    groups: Object.fromEntries(groupsByStatus.map(g => [g._id ?? 'unknown', g.count])) as Record<string, number>,
    pendingFees,
    openDisputes
  }
}

export async function adminListGroups(input: { q: string, status: string, page: number, limit: number }) {
  const filter: Record<string, unknown> = {}
  if (input.status !== 'all') filter.status = input.status
  if (input.q) filter.$or = [{ name: { $regex: escapeRegex(input.q), $options: 'i' } }, { inviteCode: input.q.toUpperCase() }]
  const [groups, total] = await Promise.all([
    Group.find(filter).sort({ createdAt: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
    Group.countDocuments(filter)
  ])
  const owners = await User.find({ _id: { $in: groups.map(g => g.owner) } }).select('name email').lean()
  const ownerById = new Map(owners.map(o => [String(o._id), o]))
  return {
    items: groups.map(g => ({
      id: String(g._id),
      name: g.name ?? '',
      status: g.status ?? 'draft',
      feeStatus: g.feeStatus ?? 'unpaid',
      inviteCode: g.inviteCode ?? '',
      members: `${g.approvedMemberCount ?? 1}/${g.plannedMemberCount ?? 0}`,
      ownerName: ownerById.get(String(g.owner))?.name ?? '',
      ownerEmail: ownerById.get(String(g.owner))?.email ?? '',
      createdAt: g.createdAt ?? null
    })),
    total,
    page: input.page,
    limit: input.limit
  }
}

export async function adminGroupDetail(groupId: string) {
  const group = await Group.findById(groupId).lean()
  if (!group) throw notFound('Group not found.')
  const [members, rounds, obligations, fee, disputes] = await Promise.all([
    GroupMember.find({ group: group._id, status: { $in: ['approved', 'pending'] } }).lean(),
    Round.find({ group: group._id }).sort({ index: 1 }).lean(),
    Obligation.find({ group: group._id }).select('round status').lean(),
    ManagementFee.findOne({ group: group._id }).lean(),
    Dispute.find({ group: group._id }).select('status category createdAt').sort({ createdAt: -1 }).lean()
  ])
  const users = await User.find({ _id: { $in: [...members.map(m => m.user), group.owner] } }).select('name email').lean()
  const userById = new Map(users.map(u => [String(u._id), u]))

  return {
    group: toGroupDto(group, null),
    inviteCode: group.inviteCode ?? '',
    owner: { name: userById.get(String(group.owner))?.name ?? '', email: userById.get(String(group.owner))?.email ?? '' },
    fee: fee ? { id: String(fee._id), status: fee.status ?? '', amount: fee.amount ?? 0, reportedAt: fee.reportedAt ?? null, verifiedAt: fee.verifiedAt ?? null } : null,
    members: members
      .map(m => ({
        name: userById.get(String(m.user))?.name ?? '',
        email: userById.get(String(m.user))?.email ?? '',
        role: m.role ?? 'member',
        status: m.status ?? 'pending',
        position: m.position ?? null
      }))
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999)),
    rounds: rounds.map((r) => {
      const list = obligations.filter(o => String(o.round) === String(r._id))
      return {
        index: r.index ?? 0,
        dueDate: r.dueDate ?? null,
        status: r.status ?? 'upcoming',
        recipientName: userById.get(String(r.recipientUser))?.name ?? '',
        confirmed: list.filter(o => o.status === 'confirmed').length,
        total: list.length
      }
    }),
    disputes: disputes.map(d => ({ id: String(d._id), status: d.status ?? 'open', category: d.category ?? 'other', createdAt: d.createdAt ?? null }))
  }
}

export async function adminAuditLog(input: { group?: string, action: string, page: number, limit: number }) {
  const filter: Record<string, unknown> = {}
  if (input.group) filter.group = input.group
  if (input.action) filter.action = { $regex: `^${escapeRegex(input.action)}` }
  const [entries, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
    AuditLog.countDocuments(filter)
  ])
  const [actors, groups] = await Promise.all([
    User.find({ _id: { $in: entries.map(e => e.actor).filter(Boolean) } }).select('name email').lean(),
    Group.find({ _id: { $in: entries.map(e => e.group).filter(Boolean) } }).select('name').lean()
  ])
  const actorById = new Map(actors.map(a => [String(a._id), a]))
  const groupById = new Map(groups.map(g => [String(g._id), g.name ?? '']))
  return {
    items: entries.map(e => ({
      id: String(e._id),
      action: e.action ?? '',
      entityType: e.entityType ?? '',
      entityId: e.entityId ? String(e.entityId) : '',
      actorName: e.actor ? actorById.get(String(e.actor))?.name || actorById.get(String(e.actor))?.email || 'Unknown' : 'System',
      groupId: e.group ? String(e.group) : null,
      groupName: e.group ? groupById.get(String(e.group)) ?? '' : '',
      before: e.before ?? null,
      after: e.after ?? null,
      reason: e.reason ?? '',
      correlationId: e.correlationId ?? '',
      createdAt: e.createdAt ?? null
    })),
    total,
    page: input.page,
    limit: input.limit
  }
}
