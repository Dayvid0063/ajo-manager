// tests/unit/schedule-engine.test.ts
import { describe, expect, it } from 'vitest'
import { buildSchedule, ScheduleError, type EngineMember } from '../../server/services/schedule-engine'

const members = (n: number): EngineMember[] =>
  Array.from({ length: n }, (_, i) => ({ memberId: `m${i + 1}`, userId: `u${i + 1}`, position: n - i })) // deliberately unordered

describe('schedule engine', () => {
  it('10 members, ₦20,000 monthly, recipient excluded → 10 rounds of ₦180,000', () => {
    const { rounds, endDate } = buildSchedule({
      startDate: '2026-01-31',
      frequency: 'monthly',
      contributionAmount: 2_000_000,
      recipientContributes: false,
      members: members(10)
    })
    expect(rounds).toHaveLength(10)
    expect(rounds.every(r => r.expectedPayout === 18_000_000)).toBe(true)
    expect(rounds.map(r => r.dueDate).slice(0, 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(endDate).toBe('2026-10-31')
  })

  it('recipient included → ₦200,000 payout, still no obligation to pay yourself', () => {
    const { rounds } = buildSchedule({
      startDate: '2026-03-01',
      frequency: 'weekly',
      contributionAmount: 2_000_000,
      recipientContributes: true,
      members: members(10)
    })
    expect(rounds[0]!.expectedPayout).toBe(20_000_000)
    for (const round of rounds) {
      expect(round.obligations).toHaveLength(9)
      expect(round.obligations.some(o => o.contributorMemberId === round.recipientMemberId)).toBe(false)
    }
  })

  it('round N goes to position N; every member collects exactly once', () => {
    const { rounds } = buildSchedule({
      startDate: '2026-03-01',
      frequency: 'weekly',
      contributionAmount: 100_000,
      recipientContributes: false,
      members: members(5)
    })
    expect(rounds.map(r => r.recipientMemberId)).toEqual(['m5', 'm4', 'm3', 'm2', 'm1'])
    expect(new Set(rounds.map(r => r.recipientMemberId)).size).toBe(5)
    expect(rounds.map(r => r.dueDate)).toEqual(['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29'])
  })

  it('is deterministic', () => {
    const input = { startDate: '2026-03-01', frequency: 'monthly' as const, contributionAmount: 500_000, recipientContributes: false, members: members(6) }
    expect(buildSchedule(input)).toEqual(buildSchedule(input))
  })

  it('rejects duplicate, missing or out-of-range positions', () => {
    const base = { startDate: '2026-03-01', frequency: 'monthly' as const, contributionAmount: 100_000, recipientContributes: false }
    expect(() => buildSchedule({ ...base, members: [{ memberId: 'a', userId: 'a', position: 1 }, { memberId: 'b', userId: 'b', position: 1 }] })).toThrow(ScheduleError)
    expect(() => buildSchedule({ ...base, members: [{ memberId: 'a', userId: 'a', position: 1 }, { memberId: 'b', userId: 'b', position: 3 }] })).toThrow(ScheduleError)
    expect(() => buildSchedule({ ...base, members: [{ memberId: 'a', userId: 'a', position: 1 }] })).toThrow(ScheduleError)
  })
})
