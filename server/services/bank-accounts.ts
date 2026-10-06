// server/services/bank-accounts.ts
// Each member's payout account for a group. Only shown to: the member, the
// group's owner/admins, and members who owe that member a payment.
import type { Types } from 'mongoose'
import { BankAccount } from '../models/bank-account'
import { withTransaction } from '../utils/db'
import { conflict } from '../utils/errors'
import { recordAudit } from './audit'
import { loadGroupForMember } from './groups'

export interface BankAccountInput {
  bankName: string
  accountNumber: string
  accountName: string
}

export function maskAccountNumber(accountNumber: string) {
  return accountNumber.length > 4 ? `******${accountNumber.slice(-4)}` : '****'
}

export function toBankAccountDto(account: { bankName?: string | null, accountNumber?: string | null, accountName?: string | null } | null) {
  if (!account) return null
  return {
    bankName: account.bankName ?? '',
    accountNumber: account.accountNumber ?? '',
    accountName: account.accountName ?? ''
  }
}

export async function getMyPayoutAccount(groupId: string, userId: string) {
  const { membership } = await loadGroupForMember(groupId, userId)
  const account = await BankAccount.findOne({ member: membership._id }).lean()
  return { account: toBankAccountDto(account) }
}

export async function setMyPayoutAccount(groupId: string, userId: string, input: BankAccountInput, correlationId?: string) {
  return withTransaction(async (session) => {
    const { group, membership } = await loadGroupForMember(groupId, userId, undefined, session)
    if (!['awaiting_members', 'active'].includes(group.status ?? '')) {
      throw conflict('Payout details can only be changed while the group is running.')
    }
    const existing = await BankAccount.findOne({ member: membership._id }).session(session)
    const before = existing ? { bankName: existing.bankName, accountNumber: maskAccountNumber(existing.accountNumber ?? '') } : null

    const account = await BankAccount.findOneAndUpdate(
      { member: membership._id },
      { $set: { ...input, group: group._id, user: userId } },
      { upsert: true, returnDocument: 'after', session }
    )
    await recordAudit(
      {
        actor: userId,
        action: 'bank_account.updated',
        entityType: 'bank_account',
        entityId: account!._id,
        group: group._id,
        // Masked — the audit log never holds full account numbers
        before,
        after: { bankName: input.bankName, accountNumber: maskAccountNumber(input.accountNumber) },
        correlationId
      },
      session
    )
    return { account: toBankAccountDto(account) }
  })
}

export async function getAccountForMember(memberId: Types.ObjectId | string) {
  return toBankAccountDto(await BankAccount.findOne({ member: memberId }).lean())
}
