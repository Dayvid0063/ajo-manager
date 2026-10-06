// shared/utils/obligation-status.ts
// What the UI shows for an obligation, derived from the stored state + dates
// (docs/state-machines.md). Never stored, so it can't drift.
import { DUE_SOON_DAYS, type DisplayStatus } from '../constants'

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Whole days from `fromYmd` to `toYmd` (negative when `toYmd` is earlier). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  return dayNumber(toYmd) - dayNumber(fromYmd)
}

export function displayStatus(stored: string, dueYmd: string, todayYmd: string): DisplayStatus {
  if (stored === 'submitted' || stored === 'confirmed' || stored === 'disputed') return stored
  const daysLeft = daysBetween(todayYmd, dueYmd)
  if (daysLeft < 0) return 'overdue' // not confirmed by the end of the due date (Lagos)
  if (stored === 'rejected') return 'rejected'
  return daysLeft <= DUE_SOON_DAYS ? 'due' : 'upcoming'
}

/** Short plain-language timing, e.g. "Due today", "Due in 3 days", "2 days overdue". */
export function dueText(dueYmd: string, todayYmd: string): string {
  const days = daysBetween(todayYmd, dueYmd)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days > 1) return `Due in ${days} days`
  return days === -1 ? '1 day overdue' : `${-days} days overdue`
}
