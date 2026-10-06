// server/services/schedule-engine.ts
// The trusted schedule engine (brief §11). Pure and deterministic: the same
// members and settings always produce the same rounds and obligations.
// Activation persists its output; unique indexes stop duplicates.
//
// Rules applied:
// - One round per member. Round N's recipient is the member at position N.
// - Round N is due on startDate + (N − 1) periods (weekly / monthly, clamped).
// - Every member except the recipient owes `contributionAmount` in each round.
// - Expected payout follows the recipientContributes rule (shared/utils/schedule).
//   With "recipient contributes", the recipient's own share is counted in the
//   payout but is not a transfer, so no obligation is created for it.
import { addPeriods } from '#shared/utils/dates'
import { payoutPerRoundKobo } from '#shared/utils/schedule'

export interface EngineMember {
  memberId: string
  userId: string
  position: number
}

export interface EngineInput {
  startDate: string // 'YYYY-MM-DD' (Lagos)
  frequency: 'weekly' | 'monthly'
  contributionAmount: number // kobo
  recipientContributes: boolean
  members: EngineMember[]
}

export interface PlannedObligation {
  contributorMemberId: string
  contributorUserId: string
  expectedAmount: number
}

export interface PlannedRound {
  index: number
  recipientMemberId: string
  recipientUserId: string
  dueDate: string
  expectedPayout: number
  obligations: PlannedObligation[]
}

export class ScheduleError extends Error {}

export function buildSchedule(input: EngineInput): { rounds: PlannedRound[], endDate: string } {
  const n = input.members.length
  if (n < 2) throw new ScheduleError('A cycle needs at least 2 members')
  if (!Number.isSafeInteger(input.contributionAmount) || input.contributionAmount <= 0) {
    throw new ScheduleError('Contribution amount must be a positive whole number of kobo')
  }

  // Positions must be exactly 1..n, each used once
  const byPosition = new Map<number, EngineMember>()
  for (const member of input.members) {
    if (!Number.isInteger(member.position) || member.position < 1 || member.position > n) {
      throw new ScheduleError(`Invalid position ${member.position}`)
    }
    if (byPosition.has(member.position)) throw new ScheduleError(`Position ${member.position} is used twice`)
    byPosition.set(member.position, member)
  }

  const payout = payoutPerRoundKobo(input.contributionAmount, n, input.recipientContributes)
  const ordered = [...input.members].sort((a, b) => a.position - b.position)

  const rounds = ordered.map((recipient, i) => ({
    index: i + 1,
    recipientMemberId: recipient.memberId,
    recipientUserId: recipient.userId,
    dueDate: addPeriods(input.startDate, input.frequency, i),
    expectedPayout: payout,
    obligations: ordered
      .filter(member => member.memberId !== recipient.memberId)
      .map(member => ({
        contributorMemberId: member.memberId,
        contributorUserId: member.userId,
        expectedAmount: input.contributionAmount
      }))
  }))

  return { rounds, endDate: rounds.at(-1)!.dueDate }
}
