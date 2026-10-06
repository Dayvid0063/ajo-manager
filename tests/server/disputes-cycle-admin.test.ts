// tests/server/disputes-cycle-admin.test.ts
// Disputes, cycle completion/closing, summaries and platform-admin views.
import { describe, expect, it } from 'vitest'
import { lagosToday, lagosYmdToDate } from '#shared/utils/dates'
import { AuditLog } from '../../server/models/audit-log'
import { Group } from '../../server/models/group'
import { Notification } from '../../server/models/notification'
import { Obligation } from '../../server/models/obligation'
import { Round } from '../../server/models/round'
import { adminAuditLog, adminGroupDetail, adminListGroups, adminOverview } from '../../server/services/admin'
import { closeCycle, getCycleSummary } from '../../server/services/cycle'
import { addDisputeMessage, getDispute, listAllDisputes, listGroupDisputes, openDispute, resolveDispute } from '../../server/services/disputes'
import { getObligationDetail, reviewRecord, submitPayment } from '../../server/services/payments'
import { createStorage } from '../../server/services/storage'
import { activeGroup, makeUser } from '../helpers/groups'
import { useTestDatabase } from '../helpers/mongo'

useTestDatabase()

const deps = { storage: createStorage({ accessKeyId: '', secretAccessKey: '', bucket: '', endpoint: '' }) }
const paid = { amount: 2_000_000, paymentDate: lagosToday(), method: 'bank_transfer', reference: 'R', note: '' }

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? 500
  }
}

const as = (id: string, isPlatformAdmin = false) => ({ id, isPlatformAdmin })

describe('disputes', () => {
  it('a member raises one; only they, managers and platform admins can see it', async () => {
    const { groupId, users, owner, platformAdmin } = await activeGroup(3)
    const { id } = await openDispute(groupId, users[1]!, { category: 'member_misconduct', description: 'Someone keeps paying late without telling anyone.' }, 'req-d')

    expect((await getDispute(id, as(users[1]!))).isMine).toBe(true)
    expect((await getDispute(id, as(owner))).canResolve).toBe(true)
    expect((await getDispute(id, as(platformAdmin, true))).canResolve).toBe(true)
    expect(await statusOf(getDispute(id, as(users[2]!)))).toBe(404)
    expect(await statusOf(getDispute(id, as(await makeUser())))).toBe(404)

    expect((await listGroupDisputes(groupId, users[2]!)).items).toHaveLength(0)
    expect((await listGroupDisputes(groupId, owner)).items).toHaveLength(1)
    expect(await AuditLog.countDocuments({ group: groupId, action: 'dispute.created' })).toBe(1)
    expect(await Notification.countDocuments({ user: owner, type: 'dispute.opened' })).toBe(1)
  })

  it('about a payment: only people involved can raise it, and the payment shows "in dispute"', async () => {
    const { groupId, users } = await activeGroup(3)
    const round1 = await Round.findOne({ group: groupId, index: 1 }).lean()
    const obligation = await Obligation.findOne({ round: round1!._id, contributorUser: users[1] }).lean()
    const obligationId = String(obligation!._id)

    expect(await statusOf(openDispute(groupId, users[2]!, { category: 'wrong_amount', description: 'This is not my payment at all.', obligationId }))).toBe(403)
    await openDispute(groupId, users[1]!, { category: 'payment_not_confirmed', description: 'I paid last week but nobody confirmed it.', obligationId })
    expect((await getObligationDetail(obligationId, users[1]!)).openDisputes).toBe(1)
  })

  it('a manager reply moves it to review; the opener cannot decide their own dispute', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    const { id } = await openDispute(groupId, owner, { category: 'other', description: 'Owner raising a general issue here.' })
    expect(await statusOf(resolveDispute(id, as(owner), { outcome: 'resolved', resolution: 'Fixed it myself' }))).toBe(403)
    expect(await statusOf(resolveDispute(id, as(users[1]!), { outcome: 'resolved', resolution: 'Not my call' }))).toBe(404)

    const { id: second } = await openDispute(groupId, users[1]!, { category: 'other', description: 'Member raising a general issue here.' })
    const afterReply = await addDisputeMessage(second, as(owner), 'Thanks, looking into it.')
    expect(afterReply.status).toBe('under_review')
    expect(afterReply.messages).toHaveLength(1)

    const resolved = await resolveDispute(second, as(owner), { outcome: 'resolved', resolution: 'Agreed to pay by Friday.' }, 'req-r')
    expect(resolved.status).toBe('resolved')
    expect(await statusOf(addDisputeMessage(second, as(users[1]!), 'One more thing'))).toBe(409)
    expect(await statusOf(resolveDispute(second, as(owner), { outcome: 'rejected', resolution: 'Again' }))).toBe(409)
    expect((await AuditLog.findOne({ action: 'dispute.resolved', entityId: second }).lean())?.reason).toBe('Agreed to pay by Friday.')
  })

  it('platform admins see every active dispute', async () => {
    const { groupId, users } = await activeGroup(2)
    await openDispute(groupId, users[1]!, { category: 'other', description: 'Platform admin should see this.' })
    const queue = await listAllDisputes({ status: 'active', page: 1, limit: 50 })
    expect(queue.items.some(d => d.groupName === 'Payments Ajo')).toBe(true)
  })
})

describe('cycle completion', () => {
  it('completes automatically when the last payment of the last round is confirmed', async () => {
    const { groupId, users, owner } = await activeGroup(2) // 2 rounds, 1 payment each
    const rounds = await Round.find({ group: groupId }).sort({ index: 1 }).lean()

    // Round 1: users[1] pays owner; round 2: owner pays users[1]
    const o1 = await Obligation.findOne({ round: rounds[0]!._id }).lean()
    const r1 = await submitPayment(String(o1!._id), users[1]!, paid, deps)
    expect((await reviewRecord(r1.id, owner, { action: 'confirm' })).cycleCompleted).toBe(false)

    const o2 = await Obligation.findOne({ round: rounds[1]!._id }).lean()
    const r2 = await submitPayment(String(o2!._id), owner, paid, deps)
    // Owner can't confirm their own; the recipient (users[1]) can
    const result = await reviewRecord(r2.id, users[1]!, { action: 'confirm' })
    expect(result.cycleCompleted).toBe(true)

    const group = await Group.findById(groupId).lean()
    expect(group?.status).toBe('completed')
    expect(group?.completedAt).toBeInstanceOf(Date)
    expect(await AuditLog.countDocuments({ group: groupId, action: 'cycle.completed' })).toBe(1)
    expect(await Notification.countDocuments({ 'data.groupId': groupId, type: 'cycle.completed' })).toBe(2)

    const summary = await getCycleSummary(groupId, users[1]!)
    expect(summary).toMatchObject({ status: 'completed', rounds: { total: 2, completed: 2 }, payments: { total: 2, confirmed: 2 } })
    expect(summary.members.every(m => m.outstanding === 0 && m.receivedConfirmed === m.expectedPayout)).toBe(true)
  })

  it('the owner can close only after the last due date; outstanding payments stay on record', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    expect(await statusOf(closeCycle(groupId, owner, 'Trying too early'))).toBe(409)

    // Move every date into the past
    const past = lagosYmdToDate('2020-01-01')
    await Round.updateMany({ group: groupId }, { dueDate: past })
    expect(await statusOf(closeCycle(groupId, users[1]!, 'Not the owner'))).toBe(403)

    const result = await closeCycle(groupId, owner, 'Two members left town; settled offline.')
    expect(result).toEqual({ status: 'completed', outstanding: 6 })
    expect(await Obligation.countDocuments({ group: groupId, status: 'pending' })).toBe(6) // untouched
    const audit = await AuditLog.findOne({ group: groupId, action: 'cycle.completed' }).lean()
    expect(audit?.after).toMatchObject({ closedEarly: true, outstandingPayments: 6 })
    expect(await statusOf(closeCycle(groupId, owner, 'Again please'))).toBe(409)
  })
})

describe('platform admin views', () => {
  it('overview, group list/detail and audit log are readable', async () => {
    const { groupId } = await activeGroup(2)
    const overview = await adminOverview()
    expect(overview.users).toBeGreaterThan(0)
    expect(overview.groups.active).toBeGreaterThan(0)

    const list = await adminListGroups({ q: 'Payments', status: 'active', page: 1, limit: 50 })
    expect(list.items.some(g => g.id === groupId)).toBe(true)

    const detail = await adminGroupDetail(groupId)
    expect(detail.rounds).toHaveLength(2)
    expect(detail.members).toHaveLength(2)
    expect(detail.group.myRole).toBeNull()

    const audit = await adminAuditLog({ group: groupId, action: 'group.', page: 1, limit: 50 })
    expect(audit.items.map(a => a.action)).toEqual(expect.arrayContaining(['group.created', 'group.activated']))
  })
})
