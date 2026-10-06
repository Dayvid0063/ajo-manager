// tests/server/payments.test.ts
// Mark as paid, review permissions, evidence, bank-detail visibility, dashboard and reminders.
import { describe, expect, it } from 'vitest'
import { lagosToday, lagosYmdToDate } from '#shared/utils/dates'
import { AuditLog } from '../../server/models/audit-log'
import { ContributionRecord } from '../../server/models/contribution-record'
import { GroupMember } from '../../server/models/group-member'
import { Notification } from '../../server/models/notification'
import { Obligation } from '../../server/models/obligation'
import { Round } from '../../server/models/round'
import { setMyPayoutAccount } from '../../server/services/bank-accounts'
import { setMemberRole } from '../../server/services/membership'
import {
  createEvidenceUpload,
  getDashboard,
  getObligationDetail,
  groupContributions,
  listMyObligations,
  recordEvidenceUrl,
  reviewRecord,
  submitPayment
} from '../../server/services/payments'
import { runReminders } from '../../server/services/reminders'
import { createMemoryStorage, createStorage } from '../../server/services/storage'
import { activeGroup, makeUser } from '../helpers/groups'
import { useTestDatabase } from '../helpers/mongo'

useTestDatabase()

const notConfigured = { storage: createStorage({ accessKeyId: '', secretAccessKey: '', bucket: '', endpoint: '' }) }

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? 500
  }
}

/** Round 1 (recipient = owner): the obligation owed by users[i]. */
async function round1Obligation(groupId: string, payer: string) {
  const round = await Round.findOne({ group: groupId, index: 1 }).lean()
  return String((await Obligation.findOne({ round: round!._id, contributorUser: payer }).lean())!._id)
}

const paid = (overrides = {}) => ({ amount: 2_000_000, paymentDate: lagosToday(), method: 'bank_transfer', reference: 'TRF-1', note: '', ...overrides })

describe('mark as paid', () => {
  it('only the person who owes can mark it as paid; it becomes a claim (submitted)', async () => {
    const { groupId, users } = await activeGroup(3)
    const obligationId = await round1Obligation(groupId, users[1]!)

    expect(await statusOf(submitPayment(obligationId, users[2]!, paid(), notConfigured))).toBe(403)
    expect(await statusOf(submitPayment(obligationId, await makeUser(), paid(), notConfigured))).toBe(404) // non-member

    const record = await submitPayment(obligationId, users[1]!, paid(), notConfigured, 'req-pay')
    expect(record.status).toBe('submitted')
    expect((await Obligation.findById(obligationId).lean())?.status).toBe('submitted')
    expect(await AuditLog.countDocuments({ group: groupId, action: 'payment.submitted' })).toBe(1)
  })

  it('requires the full amount (no partial payments in v1) and refuses double submission', async () => {
    const { groupId, users } = await activeGroup(3)
    const obligationId = await round1Obligation(groupId, users[1]!)
    expect(await statusOf(submitPayment(obligationId, users[1]!, paid({ amount: 1_000_000 }), notConfigured))).toBe(400)

    const results = await Promise.allSettled([
      submitPayment(obligationId, users[1]!, paid(), notConfigured),
      submitPayment(obligationId, users[1]!, paid(), notConfigured)
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await ContributionRecord.countDocuments({ obligation: obligationId })).toBe(1)
  })

  it('notifies the people who can confirm — never with bank details', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    await setMyPayoutAccount(groupId, owner, { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Owner Name' })
    await submitPayment(await round1Obligation(groupId, users[1]!), users[1]!, paid(), notConfigured)
    const notes = await Notification.find({ type: 'payment.submitted', 'data.groupId': groupId }).lean()
    expect(notes.map(n => String(n.user))).toContain(owner)
    expect(JSON.stringify(notes)).not.toContain('0123456789')
  })
})

describe('review', () => {
  it('nobody confirms their own claim; members who are not recipient/admin cannot review', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    const record = await submitPayment(await round1Obligation(groupId, users[1]!), users[1]!, paid(), notConfigured)

    expect(await statusOf(reviewRecord(record.id, users[1]!, { action: 'confirm' }))).toBe(403) // self
    expect(await statusOf(reviewRecord(record.id, users[2]!, { action: 'confirm' }))).toBe(403) // plain member
    expect(await statusOf(reviewRecord(record.id, owner, { action: 'confirm' }))).toBe(200) // owner is also round-1 recipient
  })

  it('the recipient can confirm when the group allows it, not when it does not', async () => {
    const { groupId, users } = await activeGroup(3, { recipientCanConfirm: false })
    // Round 2: recipient = users[1]; payer = users[2]
    const round2 = await Round.findOne({ group: groupId, index: 2 }).lean()
    const obligation = await Obligation.findOne({ round: round2!._id, contributorUser: users[2] }).lean()
    const record = await submitPayment(String(obligation!._id), users[2]!, paid(), notConfigured)
    expect(await statusOf(reviewRecord(record.id, users[1]!, { action: 'confirm' }))).toBe(403)

    // An admin can, though
    const member = await GroupMember.findOne({ group: groupId, user: users[1] }).lean()
    await setMemberRole(groupId, users[0]!, String(member!._id), 'admin')
    expect(await statusOf(reviewRecord(record.id, users[1]!, { action: 'confirm' }))).toBe(200)
  })

  it('confirm is final and happens once; reject needs a reason and allows resubmitting', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    const obligationId = await round1Obligation(groupId, users[1]!)

    const first = await submitPayment(obligationId, users[1]!, paid(), notConfigured)
    await reviewRecord(first.id, owner, { action: 'reject', reason: 'No transfer with that reference' })
    expect((await Obligation.findById(obligationId).lean())?.status).toBe('rejected')
    expect((await ContributionRecord.findById(first.id).lean())?.rejectionReason).toBe('No transfer with that reference')

    const second = await submitPayment(obligationId, users[1]!, paid({ reference: 'TRF-2' }), notConfigured)
    const results = await Promise.allSettled([
      reviewRecord(second.id, owner, { action: 'confirm' }),
      reviewRecord(second.id, owner, { action: 'confirm' })
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await Obligation.findById(obligationId).lean())?.status).toBe('confirmed')
    expect(await statusOf(submitPayment(obligationId, users[1]!, paid(), notConfigured))).toBe(409)

    // The rejected record is kept unchanged (no silent edits)
    expect((await ContributionRecord.findById(first.id).lean())?.status).toBe('rejected')
    expect(await AuditLog.countDocuments({ group: groupId, action: 'payment.confirmed' })).toBe(1)
  })

  it('a round completes when every payment in it is confirmed', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    for (const payer of [users[1]!, users[2]!]) {
      const record = await submitPayment(await round1Obligation(groupId, payer), payer, paid(), notConfigured)
      const result = await reviewRecord(record.id, owner, { action: 'confirm' })
      if (payer === users[2]) expect(result.roundCompleted).toBe(true)
    }
    expect((await Round.findOne({ group: groupId, index: 1 }).lean())?.status).toBe('completed')
  })
})

describe('bank details visibility', () => {
  it('the payer and managers see the recipient\'s account; other members do not', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    // Round 2 recipient = users[1]
    await setMyPayoutAccount(groupId, users[1]!, { bankName: 'Access', accountNumber: '1234567890', accountName: 'Member Two' })
    const round2 = await Round.findOne({ group: groupId, index: 2 }).lean()
    const obligation = await Obligation.findOne({ round: round2!._id, contributorUser: users[2] }).lean()
    const id = String(obligation!._id)

    expect((await getObligationDetail(id, users[2]!)).recipient.bank?.accountNumber).toBe('1234567890') // payer
    expect((await getObligationDetail(id, owner)).recipient.bank?.accountNumber).toBe('1234567890') // owner

    // users[1] is the recipient of this obligation — sees the claim, not needed to see own bank via it
    const asRecipient = await getObligationDetail(id, users[1]!)
    expect(asRecipient.recipient.bank).toBeNull()

    // The owner's own round-1 obligation for users[1]: users[2] is neither payer, recipient nor manager
    expect(await statusOf(getObligationDetail(await round1Obligation(groupId, users[1]!), users[2]!))).toBe(404)
  })

  it('the group board shows who paid to everyone, but claim details only to payer/recipient/managers', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    await submitPayment(await round1Obligation(groupId, users[1]!), users[1]!, paid({ reference: 'SECRET-REF' }), notConfigured)

    const asOther = await groupContributions(groupId, users[2]!)
    const row = asOther.rounds[0]!.obligations.find(o => !o.isMine && o.status === 'submitted')!
    expect(row.displayStatus).toBe('submitted')
    expect(row.latestRecord).toBeNull()

    const asOwner = await groupContributions(groupId, owner)
    const ownerRow = asOwner.rounds[0]!.obligations.find(o => o.status === 'submitted')!
    expect(ownerRow.latestRecord?.reference).toBe('SECRET-REF')
    expect(ownerRow.latestRecord?.canReview).toBe(true)
  })
})

describe('evidence uploads', () => {
  it('refuses uploads when storage is not configured', async () => {
    const { groupId, users } = await activeGroup(2)
    const obligationId = await round1Obligation(groupId, users[1]!)
    expect(await statusOf(createEvidenceUpload(users[1]!, { purpose: 'contribution', targetId: obligationId, contentType: 'image/jpeg', size: 1000 }, notConfigured))).toBe(503)
  })

  it('issues a key tied to the obligation; the key must exist and belong to it', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    const storage = createMemoryStorage()
    const deps = { storage }
    const obligationId = await round1Obligation(groupId, users[1]!)
    const otherObligation = await round1Obligation(groupId, users[2]!)

    // Not your payment → refused
    expect(await statusOf(createEvidenceUpload(users[2]!, { purpose: 'contribution', targetId: obligationId, contentType: 'image/png', size: 1000 }, deps))).toBe(403)

    const upload = await createEvidenceUpload(users[1]!, { purpose: 'contribution', targetId: obligationId, contentType: 'image/png', size: 1000 }, deps)
    expect(upload.key).toMatch(new RegExp(`^evidence/contribution/${obligationId}/[\\w-]+\\.png$`))

    // Not uploaded yet → refused
    expect(await statusOf(submitPayment(obligationId, users[1]!, paid({ evidenceKey: upload.key }), deps))).toBe(400)
    // Someone else's key → refused
    expect(await statusOf(submitPayment(otherObligation, users[2]!, paid({ evidenceKey: upload.key }), deps))).toBe(400)

    storage.uploaded.add(upload.key)
    const record = await submitPayment(obligationId, users[1]!, paid({ evidenceKey: upload.key }), deps)
    expect(record.hasEvidence).toBe(true)

    // Signed link: payer and owner yes, other member no
    expect((await recordEvidenceUrl(record.id, users[1]!, deps)).url).toContain(upload.key)
    expect((await recordEvidenceUrl(record.id, owner, deps)).url).toContain(upload.key)
    expect(await statusOf(recordEvidenceUrl(record.id, users[2]!, deps))).toBe(404)
  })
})

describe('dashboard and lists', () => {
  it('answers what I owe, to whom, when, and my next payout', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    const dash = await getDashboard(users[1]!)
    expect(dash.toPay).toHaveLength(1)
    expect(dash.toPay[0]).toMatchObject({ amount: 2_000_000, recipientName: 'Owner', roundIndex: 1, displayStatus: 'upcoming' })
    expect(dash.payouts[0]).toMatchObject({ roundIndex: 2, expectedPayout: 4_000_000, confirmed: 0, total: 2 })

    await submitPayment(await round1Obligation(groupId, users[1]!), users[1]!, paid(), notConfigured)
    expect((await getDashboard(owner)).toReview).toBe(1)
    expect((await getDashboard(users[1]!)).toPay[0]?.displayStatus).toBe('submitted')

    const list = await listMyObligations(users[1]!, { filter: 'all', page: 1, limit: 50 })
    expect(list.total).toBe(2) // rounds 1 and 3 (round 2 is theirs)
  })
})

describe('reminders', () => {
  it('sends due-soon, due-today, overdue and payout reminders — each only once', async () => {
    const { groupId, users, owner } = await activeGroup(3)
    const today = lagosYmdToDate(lagosToday()).getTime()
    const day = 86_400_000
    // Round 1 (recipient owner) due today, round 2 (recipient users[1]) in 2 days, round 3 (recipient users[2]) yesterday
    const dates = { 1: new Date(today), 2: new Date(today + 2 * day), 3: new Date(today - day) }
    for (const [index, dueDate] of Object.entries(dates)) {
      const round = await Round.findOneAndUpdate({ group: groupId, index: Number(index) }, { dueDate }, { returnDocument: 'after' }).lean()
      await Obligation.updateMany({ round: round!._id }, { dueDate })
    }

    const first = await runReminders(new Date())
    expect(first.sent).toBeGreaterThan(0)
    expect((await runReminders(new Date())).sent).toBe(0) // idempotent

    const typesFor = async (user: string) => (await Notification.find({ user, 'data.groupId': groupId, 'data.dedupeKey': { $exists: true } }).lean()).map(n => n.type).sort()
    expect(await typesFor(users[2]!)).toEqual(['contribution.due_soon', 'contribution.due_today'])
    expect(await typesFor(users[1]!)).toEqual(['contribution.due_today', 'contribution.overdue', 'payout.approaching'])
    expect(await typesFor(owner)).toEqual(['contribution.due_soon', 'contribution.overdue', 'payout.current_recipient'])
  })

  it('stops reminding once a payment is marked as paid', async () => {
    const { groupId, users } = await activeGroup(2)
    const obligationId = await round1Obligation(groupId, users[1]!)
    await Obligation.updateOne({ _id: obligationId }, { dueDate: lagosYmdToDate(lagosToday()) })
    await submitPayment(obligationId, users[1]!, paid(), notConfigured)
    await runReminders(new Date())
    expect(await Notification.countDocuments({ user: users[1], type: 'contribution.due_today' })).toBe(0)
  })
})
