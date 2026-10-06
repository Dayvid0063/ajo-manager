// tests/helpers/groups.ts
// Builds users and groups through the real services, so tests exercise the same paths as the app.
import { addPeriods, lagosToday } from '#shared/utils/dates'
import { Group } from '../../server/models/group'
import { GroupMember } from '../../server/models/group-member'
import { User } from '../../server/models/user'
import { activateGroup } from '../../server/services/activation'
import { registerUser } from '../../server/services/auth'
import { confirmFee, reportFee } from '../../server/services/fees'
import { createGroup, type CreateGroupInput } from '../../server/services/groups'
import { acceptPosition, acceptRules, approveMember, assignPosition, requestToJoin } from '../../server/services/membership'

let counter = 0

export async function makeUser(options: { admin?: boolean, name?: string } = {}) {
  const n = ++counter
  const user = await registerUser({ email: `h${n}-${Date.now()}@helpers.test`, password: 'password-123' })
  await User.updateOne({ _id: user._id }, { name: options.name ?? `Person ${n}`, isPlatformAdmin: options.admin === true })
  return String(user._id)
}

const feeConfig = { amountKobo: 370_000, bank: { name: 'Bank', accountNumber: '0123456789', accountName: 'Ajo' } }

/**
 * An ACTIVE group with `size` members: users[0] is the owner (position 1),
 * users[i] holds position i + 1. Returns ids for each member.
 */
export async function activeGroup(size = 3, overrides: Partial<CreateGroupInput> = {}) {
  const users = [await makeUser({ name: 'Owner' })]
  const platformAdmin = await makeUser({ admin: true })
  const group = await createGroup(users[0]!, {
    name: 'Payments Ajo',
    description: '',
    contributionAmount: 2_000_000,
    frequency: 'monthly',
    startDate: addPeriods(lagosToday(), 'weekly', 1),
    plannedMemberCount: size,
    recipientContributes: false,
    positionMethod: 'admin_assigns',
    recipientCanConfirm: true,
    rules: 'Pay on time. Respect each other. Disputes go to the admins.',
    ...overrides
  })
  const fee = await reportFee(group.id, users[0]!, { senderName: 'Owner', transferDate: lagosToday() }, feeConfig)
  await confirmFee(fee!.id, platformAdmin)
  const code = (await Group.findById(group.id).lean())!.inviteCode!

  for (let i = 1; i < size; i++) {
    const user = await makeUser({ name: `Member ${i + 1}` })
    await requestToJoin(code, user)
    const m = await GroupMember.findOne({ group: group.id, user }).lean()
    await approveMember(group.id, users[0]!, String(m!._id))
    users.push(user)
  }
  const memberIds: string[] = []
  for (const [i, user] of users.entries()) {
    const m = await GroupMember.findOne({ group: group.id, user }).lean()
    memberIds.push(String(m!._id))
    await assignPosition(group.id, users[0]!, String(m!._id), i + 1)
    await acceptPosition(group.id, user)
    await acceptRules(group.id, user, 1)
  }
  await activateGroup(group.id, users[0]!, {})
  return { groupId: group.id, users, memberIds, owner: users[0]!, platformAdmin }
}
