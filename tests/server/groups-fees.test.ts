// tests/server/groups-fees.test.ts
// Group creation, settings, rules and the management-fee flow against a real
// (in-memory) MongoDB replica set — including the no-double-activation guard.
import { describe, expect, it } from 'vitest'
import { addPeriods, lagosToday } from '#shared/utils/dates'
import { AuditLog } from '../../server/models/audit-log'
import { Group } from '../../server/models/group'
import { GroupMember } from '../../server/models/group-member'
import { GroupRules } from '../../server/models/group-rules'
import { ManagementFee } from '../../server/models/management-fee'
import { Notification } from '../../server/models/notification'
import { User } from '../../server/models/user'
import { registerUser } from '../../server/services/auth'
import { confirmFee, getGroupFee, rejectFee, reportFee, type FeeConfig } from '../../server/services/fees'
import { cancelGroup, createGroup, getGroupDetail, groupActivity, listMyGroups, saveRules, updateGroup, type CreateGroupInput } from '../../server/services/groups'
import { listNotifications } from '../../server/services/notifications'
import { useTestDatabase } from '../helpers/mongo'

useTestDatabase()

const config: FeeConfig = {
  amountKobo: 370_000,
  bank: { name: 'Test Bank', accountNumber: '0123456789', accountName: 'Ajo Manager Ltd' }
}

let n = 0
async function makeUser(admin = false) {
  const user = await registerUser({ email: `u${++n}@groups.test`, password: 'password-123' })
  await User.updateOne({ _id: user._id }, { name: `User ${n}`, isPlatformAdmin: admin })
  return String(user._id)
}

function groupInput(overrides: Partial<CreateGroupInput> = {}): CreateGroupInput {
  return {
    name: 'Unity Ajo',
    description: 'Family group',
    contributionAmount: 2_000_000,
    frequency: 'monthly',
    startDate: addPeriods(lagosToday(), 'monthly', 1),
    plannedMemberCount: 10,
    recipientContributes: false,
    positionMethod: 'admin_assigns',
    recipientCanConfirm: true,
    rules: 'Pay on time. Respect each other. Disputes go to the admins.',
    ...overrides
  }
}

const report = { senderName: 'Owner Name', transferDate: lagosToday(), transferReference: 'TRF123', note: '' }

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? 500
  }
}

describe('create group', () => {
  it('creates a draft with owner membership, rules v1 and audit entries', async () => {
    const owner = await makeUser()
    const dto = await createGroup(owner, groupInput(), 'req-1')

    expect(dto.status).toBe('draft')
    expect(dto.feeStatus).toBe('unpaid')
    expect(dto.myRole).toBe('owner')
    expect(dto.inviteCode).toBeNull() // hidden until invites are enabled
    expect(dto.summary?.payoutPerRound).toBe(18_000_000)

    const membership = await GroupMember.findOne({ group: dto.id, user: owner }).lean()
    expect(membership).toMatchObject({ role: 'owner', status: 'approved' })
    expect(await GroupRules.countDocuments({ group: dto.id, version: 1 })).toBe(1)
    const actions = (await AuditLog.find({ group: dto.id }).lean()).map(a => a.action).sort()
    expect(actions).toEqual(['group.created', 'rules.published'])
  })

  it('lists only my groups, and hides groups from non-members (404)', async () => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const dto = await createGroup(owner, groupInput({ name: 'Private Ajo' }))

    expect((await listMyGroups(owner)).items.map(g => g.id)).toContain(dto.id)
    expect((await listMyGroups(stranger)).items.map(g => g.id)).not.toContain(dto.id)
    expect(await statusOf(getGroupDetail(dto.id, stranger))).toBe(404)
  })
})

describe('settings and rules', () => {
  it('only the owner can change settings', async () => {
    const owner = await makeUser()
    const other = await makeUser()
    const dto = await createGroup(owner, groupInput())
    expect(await statusOf(updateGroup(dto.id, other, { name: 'Hijacked' }))).toBe(404)
  })

  it('audits what changed', async () => {
    const owner = await makeUser()
    const dto = await createGroup(owner, groupInput())
    const updated = await updateGroup(dto.id, owner, { name: 'Renamed Ajo', contributionAmount: 2_500_000 })
    expect(updated.name).toBe('Renamed Ajo')
    const audit = await AuditLog.findOne({ group: dto.id, action: 'group.settings_changed' }).lean()
    expect(audit?.before).toEqual({ name: 'Unity Ajo', contributionAmount: 2_000_000 })
    expect(audit?.after).toEqual({ name: 'Renamed Ajo', contributionAmount: 2_500_000 })
  })

  it('locks contribution settings once the fee is confirmed', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())
    const fee = await reportFee(dto.id, owner, report, config)
    await confirmFee(fee!.id, admin)

    expect(await statusOf(updateGroup(dto.id, owner, { contributionAmount: 1_000_000 }))).toBe(409)
    expect(await statusOf(updateGroup(dto.id, owner, { name: 'Still editable' }))).toBe(200)
  })

  it('edits rules in place while draft, and versions them after', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())

    expect((await saveRules(dto.id, owner, 'Updated draft rules, still version one.')).version).toBe(1)

    const fee = await reportFee(dto.id, owner, report, config)
    await confirmFee(fee!.id, admin)
    expect((await saveRules(dto.id, owner, 'New rules after members can see the group.')).version).toBe(2)
    expect(await GroupRules.countDocuments({ group: dto.id })).toBe(2)
  })
})

describe('management fee', () => {
  it('shows server-configured instructions with the group reference', async () => {
    const owner = await makeUser()
    const dto = await createGroup(owner, groupInput())
    const fee = await getGroupFee(dto.id, owner, config)
    expect(fee.amount).toBe(370_000)
    expect(fee.paymentReference).toMatch(/^AJO-[A-Z2-9]{6}$/)
    expect(fee.bank.accountNumber).toBe('0123456789')
    expect(fee.fee).toBeNull()
  })

  it('only the owner can report the fee', async () => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const dto = await createGroup(owner, groupInput())
    expect(await statusOf(reportFee(dto.id, stranger, report, config))).toBe(404)
  })

  it('report → pending, notifies platform admins, cannot double-report', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())

    const fee = await reportFee(dto.id, owner, report, config, 'req-fee')
    expect(fee?.status).toBe('pending')
    expect((await Group.findById(dto.id).lean())?.feeStatus).toBe('pending')
    expect(await Notification.countDocuments({ user: admin, type: 'fee.reported' })).toBeGreaterThan(0)
    expect(await statusOf(reportFee(dto.id, owner, report, config))).toBe(409)
  })

  it('confirm moves draft → awaiting_members in one go, enables invites, notifies the owner', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())
    const fee = await reportFee(dto.id, owner, report, config)

    const result = await confirmFee(fee!.id, admin, 'req-confirm')
    expect(result.changed).toBe(true)

    const group = await Group.findById(dto.id).lean()
    expect(group).toMatchObject({ status: 'awaiting_members', feeStatus: 'confirmed', invitesEnabled: true })
    expect((await ManagementFee.findById(fee!.id).lean())?.verifiedBy?.toString()).toBe(admin)
    expect(await AuditLog.countDocuments({ group: dto.id, action: 'fee.confirmed' })).toBe(1)

    const feed = await listNotifications(owner, { page: 1, limit: 10 })
    const note = feed.items.find(item => item.type === 'fee.confirmed')
    expect(note).toBeTruthy()
    // Notifications never carry bank details
    expect(JSON.stringify(feed)).not.toContain(config.bank.accountNumber)

    // The owner now sees the invite code
    expect((await getGroupDetail(dto.id, owner)).group.inviteCode).toMatch(/^[A-Z2-9]{6}$/)
  })

  it('confirming twice is a no-op — never a second activation', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())
    const fee = await reportFee(dto.id, owner, report, config)

    await confirmFee(fee!.id, admin)
    const again = await confirmFee(fee!.id, admin)
    expect(again.changed).toBe(false)
    expect(await AuditLog.countDocuments({ group: dto.id, action: 'fee.confirmed' })).toBe(1)
    expect(await Notification.countDocuments({ user: owner, type: 'fee.confirmed' })).toBe(1)
  })

  it('simultaneous confirmations activate exactly once', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())
    const fee = await reportFee(dto.id, owner, report, config)

    const results = await Promise.allSettled([confirmFee(fee!.id, admin), confirmFee(fee!.id, admin), confirmFee(fee!.id, admin)])
    const changed = results.filter(r => r.status === 'fulfilled' && r.value.changed).length
    expect(changed).toBe(1)
    expect(await AuditLog.countDocuments({ group: dto.id, action: 'fee.confirmed' })).toBe(1)
  })

  it('reject keeps the group in draft; the owner re-reports and history is kept', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())
    const fee = await reportFee(dto.id, owner, report, config)

    await rejectFee(fee!.id, admin, 'No transfer found with this reference')
    let group = await Group.findById(dto.id).lean()
    expect(group).toMatchObject({ status: 'draft', feeStatus: 'rejected', invitesEnabled: false })
    expect(await statusOf(confirmFee(fee!.id, admin))).toBe(409)

    const again = await reportFee(dto.id, owner, { ...report, transferReference: 'TRF999' }, config)
    expect(again?.status).toBe('pending')
    expect(again?.previousAttempts).toBe(1)
    expect(await ManagementFee.countDocuments({ group: dto.id })).toBe(1)

    await confirmFee(again!.id, admin)
    group = await Group.findById(dto.id).lean()
    expect(group?.status).toBe('awaiting_members')
  })

  it('cannot confirm a fee for a cancelled group, and nothing is half-saved', async () => {
    const owner = await makeUser()
    const admin = await makeUser(true)
    const dto = await createGroup(owner, groupInput())
    const fee = await reportFee(dto.id, owner, report, config)
    await cancelGroup(dto.id, owner, 'Changed our minds')

    expect(await statusOf(confirmFee(fee!.id, admin))).toBe(409)
    // Rolled back: the fee is still pending, the group still cancelled
    expect((await ManagementFee.findById(fee!.id).lean())?.status).toBe('pending')
    expect((await Group.findById(dto.id).lean())?.status).toBe('cancelled')
  })
})

describe('cancel and activity', () => {
  it('only the owner can cancel, and only before the group starts', async () => {
    const owner = await makeUser()
    const dto = await createGroup(owner, groupInput())
    await Group.updateOne({ _id: dto.id }, { status: 'active' })
    expect(await statusOf(cancelGroup(dto.id, owner, ''))).toBe(409)
  })

  it('activity is visible to managers with readable summaries', async () => {
    const owner = await makeUser()
    const dto = await createGroup(owner, groupInput())
    const activity = await groupActivity(dto.id, owner, { page: 1, limit: 20 })
    expect(activity.items.map(i => i.summary)).toContain('created the group')
  })
})
