// tests/unit/schedule.test.ts
import { describe, expect, it } from 'vitest'
import { addPeriods, isValidYmd, lagosYmdToDate, toLagosYmd } from '#shared/utils/dates'
import { payoutPerRoundKobo, roundDueDates, scheduleSummary, totalContributedPerMemberKobo } from '#shared/utils/schedule'

describe('payout math (brief §11)', () => {
  const amount = 2_000_000 // ₦20,000

  it('recipient included: 10 × ₦20,000 = ₦200,000', () => {
    expect(payoutPerRoundKobo(amount, 10, true)).toBe(20_000_000)
  })

  it('recipient excluded: 9 × ₦20,000 = ₦180,000', () => {
    expect(payoutPerRoundKobo(amount, 10, false)).toBe(18_000_000)
  })

  it('what each member pays in over the cycle', () => {
    expect(totalContributedPerMemberKobo(amount, 10, true)).toBe(20_000_000)
    expect(totalContributedPerMemberKobo(amount, 10, false)).toBe(18_000_000)
  })

  it('money stays in integer kobo', () => {
    expect(Number.isInteger(payoutPerRoundKobo(123_457, 7, false))).toBe(true)
  })
})

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidYmd('2026-02-28')).toBe(true)
    expect(isValidYmd('2026-02-29')).toBe(false)
    expect(isValidYmd('2028-02-29')).toBe(true)
    expect(isValidYmd('2026-13-01')).toBe(false)
    expect(isValidYmd('28/02/2026')).toBe(false)
  })

  it('stores dates as 00:00 Lagos and reads them back unchanged', () => {
    const date = lagosYmdToDate('2026-03-01')
    expect(date.toISOString()).toBe('2026-02-28T23:00:00.000Z')
    expect(toLagosYmd(date)).toBe('2026-03-01')
  })

  it('weekly adds 7 days, across month and year ends', () => {
    expect(addPeriods('2026-12-29', 'weekly', 1)).toBe('2027-01-05')
    expect(addPeriods('2026-02-26', 'weekly', 2)).toBe('2026-03-12')
  })

  it('monthly keeps the day, clamped to short months, without drifting', () => {
    expect(addPeriods('2026-01-31', 'monthly', 1)).toBe('2026-02-28')
    expect(addPeriods('2026-01-31', 'monthly', 2)).toBe('2026-03-31')
    expect(addPeriods('2028-01-31', 'monthly', 1)).toBe('2028-02-29')
    expect(addPeriods('2026-11-15', 'monthly', 3)).toBe('2027-02-15')
  })
})

describe('schedule summary', () => {
  it('one round per member, monthly dates', () => {
    expect(roundDueDates('2026-01-31', 'monthly', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('summarises a 10-member monthly group', () => {
    const summary = scheduleSummary({
      contributionAmount: 2_000_000,
      memberCount: 10,
      recipientContributes: false,
      frequency: 'monthly',
      startDate: '2026-03-01'
    })
    expect(summary).toEqual({
      rounds: 10,
      payoutPerRound: 18_000_000,
      totalPerMember: 18_000_000,
      firstDueDate: '2026-03-01',
      lastDueDate: '2026-12-01'
    })
  })
})
