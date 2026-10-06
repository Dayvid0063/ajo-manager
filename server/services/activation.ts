// server/services/activation.ts
// Readiness (computed, never stored — brief §9) and activation: one
// transaction that re-checks readiness, runs the schedule engine, writes rounds
// + obligations, flips awaiting_members → active, audits and notifies.
import type { ClientSession, Types } from 'mongoose'
import { formatLagosDate, lagosToday, lagosYmdToDate, toLagosYmd } from '#shared/utils/dates'
import { formatKobo } from '#shared/utils/money'
import { payoutPerRoundKobo } from '#shared/utils/schedule'
import { Group } from '../models/group'
import { GroupMember } from '../models/group-member'
import { GroupRules } from '../models/group-rules'
import { Obligation } from '../models/obligation'
import { Round } from '../models/round'
import { RuleAcceptance } from '../models/rule-acceptance'
import { withTransaction } from '../utils/db'
import { conflict } from '../utils/errors'
import { recordAudit } from './audit'
import { loadGroupForMember } from './groups'
import { notify } from './notifications'
import { buildSchedule } from './schedule-engine'

type GroupLike = {
  _id: Types.ObjectId
  status?: string | null
  feeStatus?: string | null
  plannedMemberCount?: number | null
  contributionAmount?: number | null
  recipientContributes?: boolean | null
  startDate?: Date | null
}

export interface ReadinessCheck {
  key: 'fee' | 'members' | 'positions' | 'positionsAccepted' | 'rules' | 'startDate'
  ok: boolean
  label: string
  detail: string
}

export const MIN_MEMBERS_TO_START = 2

/**
 * Final payout order: members sorted by their chosen/assigned position, then
 * numbered 1..n. When the group is full this changes nothing. When the owner
 * starts with fewer members, gaps close up (e.g. 1, 2, 5 → 1, 2, 3) — shown to
 * the owner before they confirm, audited, and announced to every member.
 */
export function finalPositions<T extends { _id: unknown, position?: number | null }>(members: T[]) {
  return [...members]
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
    .map((member, i) => ({ member, from: member.position ?? null, to: i + 1 }))
}

export async function computeReadiness(group: GroupLike, session?: ClientSession) {
  const members = await GroupMember.find({ group: group._id, status: 'approved' })
    .populate<{ user: { _id: Types.ObjectId, name?: string } }>('user', 'name')
    .session(session ?? null)
    .lean()
  const latest = await GroupRules.findOne({ group: group._id }).sort({ version: -1 }).select('version').session(session ?? null).lean()
  const version = latest?.version ?? 0
  const acceptances = await RuleAcceptance.find({ group: group._id, ruleVersion: version, member: { $in: members.map(m => m._id) } })
    .select('member')
    .session(session ?? null)
    .lean()
  const acceptedRules = new Set(acceptances.map(a => String(a.member)))

  const planned = group.plannedMemberCount ?? 0
  const count = members.length
  const full = count === planned
  const withPosition = members.filter(m => typeof m.position === 'number').length
  const positionsAccepted = members.filter(m => typeof m.position === 'number' && m.positionAcceptedAt).length
  const rulesAccepted = members.filter(m => acceptedRules.has(String(m._id))).length
  const startDate = group.startDate ? toLagosYmd(group.startDate) : ''
  const startOk = !!startDate && startDate >= lagosToday()

  const checks: ReadinessCheck[] = [
    { key: 'fee', ok: group.feeStatus === 'confirmed', label: 'Platform fee confirmed', detail: '' },
    {
      key: 'members',
      // Starting short is allowed (owner confirms), but never below 2 members
      ok: count >= MIN_MEMBERS_TO_START,
      label: full ? 'Everyone has joined' : 'Enough members to start',
      detail: full ? `${count} of ${planned} members` : `${count} of ${planned} planned members have joined${count < MIN_MEMBERS_TO_START ? ` — at least ${MIN_MEMBERS_TO_START} needed` : ''}`
    },
    { key: 'positions', ok: count > 0 && withPosition === count, label: 'Every member has a payout position', detail: `${withPosition} of ${count} positions set` },
    { key: 'positionsAccepted', ok: count > 0 && positionsAccepted === count, label: 'Every member accepted their position', detail: `${positionsAccepted} of ${count} accepted` },
    { key: 'rules', ok: count > 0 && rulesAccepted === count, label: `Every member accepted the rules (version ${version})`, detail: `${rulesAccepted} of ${count} accepted` },
    {
      key: 'startDate',
      ok: startOk,
      label: 'First due date is still ahead',
      detail: startDate ? (startOk ? formatLagosDate(startDate) : `${formatLagosDate(startDate)} has passed — choose a new date when you start`) : 'Not set'
    }
  ]

  // Preview of the payout order the group would start with
  const order = withPosition === count ? finalPositions(members) : []
  const renumbered = order
    .filter(o => o.from !== o.to)
    .map(o => ({ memberId: String(o.member._id), name: o.member.user?.name || 'Member', from: o.from, to: o.to }))

  // A passed start date doesn't block: the owner picks a new one at activation
  const blocking = checks.filter(c => c.key !== 'startDate' && !c.ok)
  return {
    ready: group.status === 'awaiting_members' && blocking.length === 0,
    needsNewStartDate: !startOk,
    full,
    memberCount: count,
    plannedMemberCount: planned,
    // What the payout would be with the members who have actually joined
    payoutPerRound: payoutPerRoundKobo(group.contributionAmount ?? 0, count, group.recipientContributes === true),
    renumbered,
    checks
  }
}

export async function getReadiness(groupId: string, userId: string) {
  const { group } = await loadGroupForMember(groupId, userId)
  return computeReadiness(group)
}

export interface ActivateInput {
  startDate?: string
  // Required when starting with fewer members than planned
  confirmFewerMembers?: boolean
}

export async function activateGroup(groupId: string, actorId: string, input: ActivateInput, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, actorId, ['owner'], session)
    if (group.status === 'active') throw conflict('This group has already started.')
    if (group.status !== 'awaiting_members') throw conflict('This group cannot be started.')

    const readiness = await computeReadiness(group, session)
    if (!readiness.ready) {
      const missing = readiness.checks.filter(c => c.key !== 'startDate' && !c.ok).map(c => c.label.toLowerCase())
      throw conflict(`Not ready to start yet: ${missing.join(', ')}.`)
    }
    if (!readiness.full && !input.confirmFewerMembers) {
      throw conflict(`Only ${readiness.memberCount} of ${readiness.plannedMemberCount} members have joined. Confirm that you want to start with ${readiness.memberCount} members.`)
    }
    if (readiness.needsNewStartDate && !input.startDate) {
      throw conflict('The first due date has passed. Choose a new first due date to start the group.')
    }
    const startDate = input.startDate ?? toLagosYmd(group.startDate!)
    const plannedBefore = group.plannedMemberCount ?? 0

    // Flip the state first, conditionally — a second activation finds nothing to update.
    // The cycle is sized to the members who actually joined.
    const activated = await Group.findOneAndUpdate(
      { _id: group._id, status: 'awaiting_members' },
      {
        $set: {
          status: 'active',
          activatedAt: new Date(),
          invitesEnabled: false,
          startDate: lagosYmdToDate(startDate),
          plannedMemberCount: readiness.memberCount
        }
      },
      { returnDocument: 'after', session }
    )
    if (!activated) throw conflict('This group has already started.')

    // Close any gaps in the payout order (only possible when starting short)
    const approved = await GroupMember.find({ group: group._id, status: 'approved' }).session(session).lean()
    const order = finalPositions(approved)
    const moved = order.filter(o => o.from !== o.to)
    if (moved.length) {
      // Clear first so the unique (group, position) index never sees a temporary clash
      await GroupMember.updateMany({ _id: { $in: moved.map(o => o.member._id) } }, { $unset: { position: '' } }, { session })
      for (const o of moved) {
        await GroupMember.updateOne({ _id: o.member._id }, { $set: { position: o.to } }, { session })
      }
    }
    const members = order.map(o => ({ ...o.member, position: o.to }))

    const schedule = buildSchedule({
      startDate,
      frequency: (group.frequency ?? 'monthly') as 'weekly' | 'monthly',
      contributionAmount: group.contributionAmount ?? 0,
      recipientContributes: group.recipientContributes === true,
      members: members.map(m => ({ memberId: String(m._id), userId: String(m.user), position: m.position }))
    })

    const roundDocs = await Round.insertMany(
      schedule.rounds.map(round => ({
        group: group._id,
        index: round.index,
        recipientMember: round.recipientMemberId,
        recipientUser: round.recipientUserId,
        dueDate: lagosYmdToDate(round.dueDate),
        expectedPayout: round.expectedPayout,
        status: 'upcoming'
      })),
      { session }
    )
    const roundIdByIndex = new Map(roundDocs.map(doc => [doc.index, doc._id]))
    await Obligation.insertMany(
      schedule.rounds.flatMap(round =>
        round.obligations.map(o => ({
          group: group._id,
          round: roundIdByIndex.get(round.index),
          contributorMember: o.contributorMemberId,
          contributorUser: o.contributorUserId,
          expectedAmount: o.expectedAmount,
          dueDate: lagosYmdToDate(round.dueDate),
          status: 'pending'
        }))
      ),
      { session }
    )

    await recordAudit(
      {
        actor: actorId,
        action: 'group.activated',
        entityType: 'group',
        entityId: group._id,
        group: group._id,
        before: { status: 'awaiting_members', plannedMemberCount: plannedBefore },
        after: {
          status: 'active',
          startDate,
          endDate: schedule.endDate,
          rounds: schedule.rounds.length,
          plannedMemberCount: readiness.memberCount,
          startedShort: !readiness.full,
          // Every position that moved when gaps were closed
          renumbered: moved.map(o => ({ memberId: String(o.member._id), from: o.from, to: o.to }))
        },
        correlationId
      },
      session
    )

    // Tell each member their final position, when they pay and when they collect
    const first = schedule.rounds[0]!
    const movedIds = new Set(moved.map(o => String(o.member._id)))
    for (const member of members) {
      const myRound = schedule.rounds.find(r => r.recipientMemberId === String(member._id))!
      const positionNote = movedIds.has(String(member._id)) ? ` Your payout position is now number ${member.position} because the group started with ${members.length} members.` : ''
      await notify(
        [member.user!],
        {
          type: 'cycle.activated',
          title: `"${group.name}" has started`,
          body: `First payment is due ${formatLagosDate(first.dueDate)}. Your payout of ${formatKobo(myRound.expectedPayout)} is on ${formatLagosDate(myRound.dueDate)}.${positionNote}`,
          data: { groupId: String(group._id), link: `/groups/${group._id}/schedule` }
        },
        session
      )
    }

    return { status: 'active', startDate, endDate: schedule.endDate, rounds: schedule.rounds.length, myRole: membership.role }
  })
}

// ── Schedule view ─────────────────────────────────────────────────────────

export async function getSchedule(groupId: string, userId: string) {
  const { group, membership } = await loadGroupForMember(groupId, userId)
  const rounds = await Round.find({ group: group._id }).sort({ index: 1 }).lean()
  const members = await GroupMember.find({ group: group._id, status: 'approved' }).populate<{ user: { name?: string } }>('user', 'name').lean()
  const nameByMember = new Map(members.map(m => [String(m._id), m.user?.name || 'Member']))
  const today = lagosToday()

  return {
    rounds: rounds.map((round) => {
      const due = round.dueDate ? toLagosYmd(round.dueDate) : ''
      return {
        id: String(round._id),
        index: round.index ?? 0,
        dueDate: due,
        expectedPayout: round.expectedPayout ?? 0,
        recipientName: nameByMember.get(String(round.recipientMember)) ?? 'Member',
        isMine: String(round.recipientMember) === String(membership._id),
        isPast: !!due && due < today
      }
    })
  }
}
