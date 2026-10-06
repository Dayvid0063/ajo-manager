// tests/unit/obligation-status.test.ts
import { describe, expect, it } from 'vitest'
import { daysBetween, displayStatus, dueText } from '#shared/utils/obligation-status'
import { evidenceKeyBelongsTo, evidenceKeyFor } from '../../server/services/storage'

describe('display status (docs/state-machines.md)', () => {
  const today = '2026-03-10'
  it('pending: upcoming → due (3 days before) → overdue (after the due date)', () => {
    expect(displayStatus('pending', '2026-03-20', today)).toBe('upcoming')
    expect(displayStatus('pending', '2026-03-13', today)).toBe('due')
    expect(displayStatus('pending', '2026-03-10', today)).toBe('due')
    expect(displayStatus('pending', '2026-03-09', today)).toBe('overdue')
  })

  it('a rejected claim shows rejected, then overdue once the date passes', () => {
    expect(displayStatus('rejected', '2026-03-12', today)).toBe('rejected')
    expect(displayStatus('rejected', '2026-03-01', today)).toBe('overdue')
  })

  it('submitted/confirmed/disputed never become overdue', () => {
    for (const status of ['submitted', 'confirmed', 'disputed']) {
      expect(displayStatus(status, '2026-01-01', today)).toBe(status)
    }
  })

  it('plain-language timing', () => {
    expect(dueText('2026-03-10', today)).toBe('Due today')
    expect(dueText('2026-03-11', today)).toBe('Due tomorrow')
    expect(dueText('2026-03-15', today)).toBe('Due in 5 days')
    expect(dueText('2026-03-09', today)).toBe('1 day overdue')
    expect(dueText('2026-03-01', today)).toBe('9 days overdue')
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
  })
})

describe('evidence keys', () => {
  it('are tied to one obligation and use a safe extension', () => {
    const id = '65f1c2a9b4e3d2a1f0e9d8c7'
    const key = evidenceKeyFor('contribution', id, 'application/pdf')
    expect(key).toMatch(/^evidence\/contribution\/65f1c2a9b4e3d2a1f0e9d8c7\/[\w-]+\.pdf$/)
    expect(evidenceKeyBelongsTo(key, 'contribution', id)).toBe(true)
    expect(evidenceKeyBelongsTo(key, 'contribution', '65f1c2a9b4e3d2a1f0e9d8c8')).toBe(false)
    expect(evidenceKeyBelongsTo(key, 'fee', id)).toBe(false)
    expect(() => evidenceKeyFor('contribution', id, 'text/html')).toThrow()
  })
})
