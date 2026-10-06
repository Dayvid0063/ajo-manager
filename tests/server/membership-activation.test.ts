// tests/server/membership-activation.test.ts
// Joining, approvals, positions, rules acceptance, readiness and activation.
import { describe, expect, it } from 'vitest'
import { addPeriods, lagosToday, lagosYmdToDate } from '#shared/utils/dates'
import { AuditLog } from '../../server/models/audit-log'
import { Group } from '../../server/models/group'
import { GroupMember } from '../../server/models/group-member'
import { Obligation } from '../../server/models/obligation'
import { Round } from '../../server/models/round'
import { User } from '../../server/models/user'
import { activateGroup, getReadiness, getSchedule } from '../../server/services/activation'
import { registerUser } from '../../server/services/auth'
import { confirmFee, reportFee } from '../../server/services/fees'
import { createGroup, getGroupDetail, listMyGroups, saveRules, type CreateGroupInput } from '../../server/services/groups'
import {
  acceptPosition,
  acceptRules,
  approveMember,
  assignPosition,
  drawPositions,
  getJoinSummary,
  listMembers,
  pickPosition,
  rejectMember,
  removeMember,
  requestToJoin,
  setMemberRole
} from '../../server/services/membership'
import { useTestDatabase } from '../helpers/mongo'

useTestDatabase()

const feeConfig = { amountKobo: 370_000, bank: { name: 'Bank', accountNumber: '0123456789', accountName: 'Ajo' } }
let n = 0

async function makeUser(admin = false) {
  const user = await registerUser({ email: `m${++n}@members.test`, password: 'password-123' })
  await User.updateOne({ _id: user._id }, { name: `Member ${n}`, isPlatformAdmin: admin })
  return String(user._id)
}

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? 500
  }
}

/** A group whose fee is confirmed (awaiting_members), plus helpers. */
async function openGroup(overrides: Partial<CreateGroupInput> = {}) {
  const owner = await makeUser()
  const platformAdmin = await makeUser(true)
  const group = await createGroup(owner, {
    name: 'Test Ajo',
    description: '',
    contributionAmount: 2_000_000,
    frequency: 'monthly',
    startDate: addPeriods(lagosToday(), 'monthly', 1),
    plannedMemberCount: 3,
    recipientContributes: false,
    positionMethod: 'admin_assigns',
    recipientCanConfirm: true,
    rules: 'Pay on time. Respect each other. Disputes go to the admins.',
    ...overrides
  })
  const fee = await reportFee(group.id, owner, { senderName: 'Owner', transferDate: lagosToday() }, feeConfig)
  await confirmFee(fee!.id, platformAdmin)
  const code = (await Group.findById(group.id).lean())!.inviteCode!
  return { owner, groupId: group.id, code }
}

async function join(groupId: string, code: string, owner: string) {
  const user = await makeUser()
  await requestToJoin(code, user)
  const member = await GroupMember.findOne({ group: groupId, user }).lean()
  await approveMember(groupId, owner, String(member!._id))
  return { user, memberId: String(member!._id) }
}

async function memberIdOf(groupId: string, user: string) {
  return String((await GroupMember.findOne({ group: groupId, user }).lean())!._id)
}

/** Fill, position, accept everything — ready to activate. */
async function readyGroup(overrides: Partial<CreateGroupInput> = {}) {
  const ctx = await openGroup(overrides)
  const others = [await join(ctx.groupId, ctx.code, ctx.owner), await join(ctx.groupId, ctx.code, ctx.owner)]
  const everyone = [{ user: ctx.owner, memberId: await memberIdOf(ctx.groupId, ctx.owner) }, ...others]
  for (const [i, m] of everyone.entries()) {
    await assignPosition(ctx.groupId, ctx.owner, m.memberId, i + 1)
    await acceptPosition(ctx.groupId, m.user)
    await acceptRules(ctx.groupId, m.user, 1)
  }
  return { ...ctx, everyone }
}

describe('joining', () => {
  it('anyone with the code sees a limited summary; bad codes are 404', async () => {
    const { code } = await openGroup()
    const summary = await getJoinSummary(code, null)
    expect(summary).toMatchObject({ name: 'Test Ajo', acceptingMembers: true, approvedMemberCount: 1, plannedMemberCount: 3 })
    expect(summary.groupId).toBeNull()
    expect(JSON.stringify(summary)).not.toContain('@') // no emails
    expect(await statusOf(getJoinSummary('ZZZZZZ', null))).toBe(404)
  })

  it('draft groups (fee not confirmed) cannot be joined', async () => {
    const owner = await makeUser()
    const draft = await createGroup(owner, {
      name: 'Draft', contributionAmount: 100_000, frequency: 'weekly', startDate: addPeriods(lagosToday(), 'weekly', 1),
      plannedMemberCount: 3, recipientContributes: false, positionMethod: 'random', recipientCanConfirm: true, rules: 'Some rules for the draft group here.'
    })
    const code = (await Group.findById(draft.id).lean())!.inviteCode!
    expect(await statusOf(requestToJoin(code, await makeUser()))).toBe(404)
  })

  it('request → pending (idempotent), applicant sees it as pending, not the group', async () => {
    const { groupId, code } = await openGroup()
    const user = await makeUser()
    expect((await requestToJoin(code, user)).changed).toBe(true)
    expect((await requestToJoin(code, user)).changed).toBe(false)
    expect(await GroupMember.countDocuments({ group: groupId, user })).toBe(1)

    const mine = await listMyGroups(user)
    expect(mine.items).toHaveLength(0)
    expect(mine.pending[0]?.name).toBe('Test Ajo')
    expect(await statusOf(getGroupDetail(groupId, user))).toBe(404)
  })

  it('only owner/admins approve; members cannot', async () => {
    const { groupId, code, owner } = await openGroup()
    const { user: member } = await join(groupId, code, owner)
    const applicant = await makeUser()
    await requestToJoin(code, applicant)
    const pendingId = await memberIdOf(groupId, applicant)
    expect(await statusOf(approveMember(groupId, member, pendingId))).toBe(403)
    expect(await statusOf(approveMember(groupId, owner, pendingId))).toBe(200)
  })

  it('never approves more members than planned — even simultaneously', async () => {
    const { groupId, code, owner } = await openGroup() // 3 planned, owner already in
    const applicants = [await makeUser(), await makeUser(), await makeUser(), await makeUser()]
    for (const a of applicants) await requestToJoin(code, a)
    const ids = await Promise.all(applicants.map(a => memberIdOf(groupId, a)))

    const results = await Promise.allSettled(ids.map(id => approveMember(groupId, owner, id)))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2)
    expect(await GroupMember.countDocuments({ group: groupId, status: 'approved' })).toBe(3)
    expect((await Group.findById(groupId).lean())?.approvedMemberCount).toBe(3)
    expect(await statusOf(requestToJoin(code, await makeUser()))).toBe(409) // full
  })

  it('rejecting and re-requesting works; rejection is audited with a reason', async () => {
    const { groupId, code, owner } = await openGroup()
    const user = await makeUser()
    await requestToJoin(code, user)
    await rejectMember(groupId, owner, await memberIdOf(groupId, user), 'We do not know you')
    expect((await AuditLog.findOne({ group: groupId, action: 'membership.rejected' }).lean())?.reason).toBe('We do not know you')
    expect((await requestToJoin(code, user)).changed).toBe(true)
  })
})

describe('roles and members list', () => {
  it('only the owner promotes; admins can then approve; contact details only for managers', async () => {
    const { groupId, code, owner } = await openGroup({ plannedMemberCount: 4 })
    const a = await join(groupId, code, owner)
    const b = await join(groupId, code, owner)
    expect(await statusOf(setMemberRole(groupId, a.user, b.memberId, 'admin'))).toBe(403)
    await setMemberRole(groupId, owner, a.memberId, 'admin')

    const applicant = await makeUser()
    await requestToJoin(code, applicant)
    expect(await statusOf(approveMember(groupId, a.user, await memberIdOf(groupId, applicant)))).toBe(200)

    const asMember = await listMembers(groupId, b.user)
    expect(asMember.pending).toEqual([])
    expect(asMember.members.every(m => m.email === undefined)).toBe(true)
    const asAdmin = await listMembers(groupId, a.user)
    expect(asAdmin.members.some(m => m.email)).toBe(true)
  })

  it('removing a member frees their slot and position', async () => {
    const { groupId, code, owner } = await openGroup()
    const a = await join(groupId, code, owner)
    await assignPosition(groupId, owner, a.memberId, 2)
    await removeMember(groupId, owner, a.memberId, 'Left the group')
    const doc = await GroupMember.findById(a.memberId).lean()
    expect(doc?.status).toBe('removed')
    expect(doc?.position).toBeUndefined()
    expect((await Group.findById(groupId).lean())?.approvedMemberCount).toBe(1)
  })
})

describe('positions', () => {
  it('two members can never hold the same position', async () => {
    const { groupId, code, owner } = await openGroup()
    const a = await join(groupId, code, owner)
    const b = await join(groupId, code, owner)
    await assignPosition(groupId, owner, a.memberId, 1)
    expect(await statusOf(assignPosition(groupId, owner, b.memberId, 1))).toBe(409)
    expect(await statusOf(assignPosition(groupId, owner, b.memberId, 9))).toBe(409) // out of range
  })

  it('re-assigning a position needs acceptance again', async () => {
    const { groupId, code, owner } = await openGroup()
    const a = await join(groupId, code, owner)
    await assignPosition(groupId, owner, a.memberId, 1)
    await acceptPosition(groupId, a.user)
    await assignPosition(groupId, owner, a.memberId, 2)
    expect((await GroupMember.findById(a.memberId).lean())?.positionAcceptedAt).toBeUndefined()
  })

  it('members_pick: members choose open slots; clashes are refused', async () => {
    const { groupId, code, owner } = await openGroup({ positionMethod: 'members_pick' })
    const a = await join(groupId, code, owner)
    const b = await join(groupId, code, owner)
    await pickPosition(groupId, a.user, 2)
    expect(await statusOf(pickPosition(groupId, b.user, 2))).toBe(409)
    expect(await statusOf(assignPosition(groupId, owner, b.memberId, 3))).toBe(409) // wrong method
    await pickPosition(groupId, b.user, 3)
    expect((await listMembers(groupId, owner)).openPositions).toEqual([1])
  })

  it('random draw: needs 2+ members, can be redrawn as people join, gives unique positions', async () => {
    const { groupId, code, owner } = await openGroup({ positionMethod: 'random' })
    expect(await statusOf(drawPositions(groupId, owner))).toBe(409) // only the owner so far
    await join(groupId, code, owner)
    await drawPositions(groupId, owner)
    let positions = (await GroupMember.find({ group: groupId, status: 'approved' }).lean()).map(m => m.position).sort()
    expect(positions).toEqual([1, 2])

    await join(groupId, code, owner)
    await drawPositions(groupId, owner)
    positions = (await GroupMember.find({ group: groupId, status: 'approved' }).lean()).map(m => m.position).sort()
    expect(positions).toEqual([1, 2, 3])
    await drawPositions(groupId, owner) // redraw allowed before anyone accepts
    await acceptPosition(groupId, owner)
    expect(await statusOf(drawPositions(groupId, owner))).toBe(409)
  })
})

describe('rules acceptance', () => {
  it('must accept the latest version; a new version needs a new acceptance', async () => {
    const { groupId, code, owner } = await openGroup()
    const a = await join(groupId, code, owner)
    await acceptRules(groupId, a.user, 1)
    expect((await getGroupDetail(groupId, a.user)).me.rulesAccepted).toBe(true)

    await saveRules(groupId, owner, 'Version two of the rules with a new late payment policy.')
    expect((await getGroupDetail(groupId, a.user)).me.rulesAccepted).toBe(false)
    expect(await statusOf(acceptRules(groupId, a.user, 1))).toBe(409)
    await acceptRules(groupId, a.user, 2)
    expect((await getGroupDetail(groupId, a.user)).me.rulesAccepted).toBe(true)
  })
})

describe('readiness and activation', () => {
  it('readiness lists what is missing', async () => {
    const { groupId, code, owner } = await openGroup()
    let readiness = await getReadiness(groupId, owner)
    expect(readiness.checks.find(c => c.key === 'members')?.ok).toBe(false) // only the owner: below 2

    await join(groupId, code, owner)
    readiness = await getReadiness(groupId, owner)
    expect(readiness.ready).toBe(false)
    expect(readiness.full).toBe(false)
    expect(readiness.checks.find(c => c.key === 'members')).toMatchObject({ ok: true, detail: '2 of 3 planned members have joined' })
    expect(readiness.checks.find(c => c.key === 'positions')).toMatchObject({ ok: false, detail: '0 of 2 positions set' })
    expect(await statusOf(activateGroup(groupId, owner, {}))).toBe(409)
  })

  it('the owner can start with fewer members: confirmed, gaps closed, payout from actual members', async () => {
    const { groupId, code, owner } = await openGroup({ plannedMemberCount: 5 }) // ₦20,000, recipient excluded
    const a = await join(groupId, code, owner)
    const b = await join(groupId, code, owner)
    const ownerMemberId = await memberIdOf(groupId, owner)
    // Positions with gaps: owner 1, a 3, b 5
    const plan = [[owner, ownerMemberId, 1], [a.user, a.memberId, 3], [b.user, b.memberId, 5]] as const
    for (const [user, memberId, position] of plan) {
      await assignPosition(groupId, owner, memberId, position)
      await acceptPosition(groupId, user)
      await acceptRules(groupId, user, 1)
    }

    const readiness = await getReadiness(groupId, owner)
    expect(readiness).toMatchObject({ ready: true, full: false, memberCount: 3, payoutPerRound: 4_000_000 })
    expect(readiness.renumbered.map(r => [r.from, r.to])).toEqual([[3, 2], [5, 3]])

    // Must be confirmed explicitly
    expect(await statusOf(activateGroup(groupId, owner, {}))).toBe(409)
    expect(await Round.countDocuments({ group: groupId })).toBe(0)

    await activateGroup(groupId, owner, { confirmFewerMembers: true })
    const group = await Group.findById(groupId).lean()
    expect(group).toMatchObject({ status: 'active', plannedMemberCount: 3 })

    const rounds = await Round.find({ group: groupId }).sort({ index: 1 }).lean()
    expect(rounds.map(r => String(r.recipientMember))).toEqual([ownerMemberId, a.memberId, b.memberId])
    expect(rounds.every(r => r.expectedPayout === 4_000_000)).toBe(true) // 2 payers × ₦20,000, not 4 × ₦20,000
    expect(await Obligation.countDocuments({ group: groupId })).toBe(6)
    expect((await GroupMember.findById(b.memberId).lean())?.position).toBe(3)

    const audit = await AuditLog.findOne({ group: groupId, action: 'group.activated' }).lean()
    expect(audit?.after).toMatchObject({ startedShort: true, plannedMemberCount: 3 })
    expect(audit?.before).toMatchObject({ plannedMemberCount: 5 })
  })

  it('never starts with fewer than 2 members', async () => {
    const { groupId, owner } = await openGroup()
    const ownerMemberId = await memberIdOf(groupId, owner)
    await assignPosition(groupId, owner, ownerMemberId, 1)
    await acceptPosition(groupId, owner)
    await acceptRules(groupId, owner, 1)
    expect((await getReadiness(groupId, owner)).ready).toBe(false)
    expect(await statusOf(activateGroup(groupId, owner, { confirmFewerMembers: true }))).toBe(409)
  })

  it('only the owner can activate', async () => {
    const { groupId, everyone } = await readyGroup()
    expect(await statusOf(activateGroup(groupId, everyone[1]!.user, {}))).toBe(403)
  })

  it('activation creates rounds + obligations once, flips to active, closes invites', async () => {
    const { groupId, owner, everyone } = await readyGroup()
    expect((await getReadiness(groupId, owner)).ready).toBe(true)

    const result = await activateGroup(groupId, owner, {}, 'req-activate')
    expect(result).toMatchObject({ status: 'active', rounds: 3 })

    const group = await Group.findById(groupId).lean()
    expect(group).toMatchObject({ status: 'active', invitesEnabled: false })
    const rounds = await Round.find({ group: groupId }).sort({ index: 1 }).lean()
    expect(rounds.map(r => String(r.recipientMember))).toEqual(everyone.map(m => m.memberId))
    expect(rounds.every(r => r.expectedPayout === 4_000_000)).toBe(true) // 2 × ₦20,000 (recipient excluded)
    expect(await Obligation.countDocuments({ group: groupId })).toBe(6) // 3 rounds × 2 payers
    expect(await AuditLog.countDocuments({ group: groupId, action: 'group.activated' })).toBe(1)

    // Second activation: refused, nothing duplicated
    expect(await statusOf(activateGroup(groupId, owner, {}))).toBe(409)
    expect(await Round.countDocuments({ group: groupId })).toBe(3)
    expect(await Obligation.countDocuments({ group: groupId })).toBe(6)

    const schedule = await getSchedule(groupId, everyone[2]!.user)
    expect(schedule.rounds.find(r => r.isMine)?.index).toBe(3)
  })

  it('simultaneous activations produce exactly one schedule', async () => {
    const { groupId, owner } = await readyGroup()
    const results = await Promise.allSettled([activateGroup(groupId, owner, {}), activateGroup(groupId, owner, {}), activateGroup(groupId, owner, {})])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await Round.countDocuments({ group: groupId })).toBe(3)
    expect(await Obligation.countDocuments({ group: groupId })).toBe(6)
  })

  it('a passed first due date requires choosing a new one', async () => {
    const { groupId, owner } = await readyGroup()
    await Group.updateOne({ _id: groupId }, { startDate: lagosYmdToDate('2020-01-01') })
    expect(await statusOf(activateGroup(groupId, owner, {}))).toBe(409)

    const newStart = addPeriods(lagosToday(), 'weekly', 1)
    const result = await activateGroup(groupId, owner, { startDate: newStart })
    expect(result.startDate).toBe(newStart)
    const first = await Round.findOne({ group: groupId, index: 1 }).lean()
    expect(first?.dueDate?.toISOString()).toBe(lagosYmdToDate(newStart).toISOString())
  })

  it('no member changes after activation', async () => {
    const { groupId, owner, everyone } = await readyGroup()
    await activateGroup(groupId, owner, {})
    expect(await statusOf(assignPosition(groupId, owner, everyone[1]!.memberId, 2))).toBe(409)
    expect(await statusOf(removeMember(groupId, owner, everyone[1]!.memberId, ''))).toBe(409)
    const code = (await Group.findById(groupId).lean())!.inviteCode!
    expect(await statusOf(requestToJoin(code, await makeUser()))).toBe(409)
  })
})
