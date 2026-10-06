// shared/utils/schedule.ts
// Pure payout/schedule math shared by the UI (previews) and the server
// (the trusted schedule engine in Phase 4 builds on these).
import { addPeriods } from './dates'

export interface ScheduleInput {
  contributionAmount: number // kobo
  memberCount: number
  recipientContributes: boolean
  frequency: 'weekly' | 'monthly'
  startDate: string // 'YYYY-MM-DD' (Lagos)
}

/** One round per member — each member receives exactly one payout per cycle. */
export function roundCount(memberCount: number): number {
  return memberCount
}

/**
 * Expected payout per round, in kobo (brief §11, locked rule §4.8):
 * recipient contributes   → amount × members        (10 × ₦20,000 = ₦200,000)
 * recipient doesn't        → amount × (members − 1)  (9 × ₦20,000 = ₦180,000)
 */
export function payoutPerRoundKobo(contributionAmount: number, memberCount: number, recipientContributes: boolean): number {
  const contributors = recipientContributes ? memberCount : memberCount - 1
  return contributionAmount * Math.max(0, contributors)
}

/** What each member pays in over the whole cycle, in kobo. */
export function totalContributedPerMemberKobo(contributionAmount: number, memberCount: number, recipientContributes: boolean): number {
  const roundsPaid = recipientContributes ? memberCount : memberCount - 1
  return contributionAmount * Math.max(0, roundsPaid)
}

export function roundDueDates(startDate: string, frequency: 'weekly' | 'monthly', count: number): string[] {
  return Array.from({ length: count }, (_, index) => addPeriods(startDate, frequency, index))
}

export function scheduleSummary(input: ScheduleInput) {
  const rounds = roundCount(input.memberCount)
  const dueDates = roundDueDates(input.startDate, input.frequency, rounds)
  return {
    rounds,
    payoutPerRound: payoutPerRoundKobo(input.contributionAmount, input.memberCount, input.recipientContributes),
    totalPerMember: totalContributedPerMemberKobo(input.contributionAmount, input.memberCount, input.recipientContributes),
    firstDueDate: dueDates[0] ?? input.startDate,
    lastDueDate: dueDates.at(-1) ?? input.startDate
  }
}
