// shared/utils/dates.ts
// Calendar dates for the schedule are handled as 'YYYY-MM-DD' strings in
// Africa/Lagos time (UTC+1, no daylight saving) and stored as the Date at
// 00:00 Lagos on that day. Display always uses the Lagos timezone.

export const LAGOS_TZ = 'Africa/Lagos'
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidYmd(value: string): boolean {
  const match = YMD.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number) as [number, number, number, number]
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The Lagos calendar date for an instant, as 'YYYY-MM-DD'. */
export function toLagosYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function lagosToday(): string {
  return toLagosYmd(new Date())
}

/** 'YYYY-MM-DD' → the instant 00:00 in Lagos on that day. */
export function lagosYmdToDate(ymd: string): Date {
  if (!isValidYmd(ymd)) throw new Error(`Invalid date: ${ymd}`)
  return new Date(`${ymd}T00:00:00+01:00`)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Add `count` weekly or monthly periods to a calendar date.
 * Monthly keeps the original day of the month, clamped to short months
 * (31 Jan + 1 month = 28/29 Feb; + 2 months = 31 Mar — not 28 Mar).
 */
export function addPeriods(ymd: string, frequency: 'weekly' | 'monthly', count: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  if (frequency === 'weekly') {
    const date = new Date(Date.UTC(y, m - 1, d + 7 * count))
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  }
  const monthIndex = m - 1 + count
  const year = y + Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  return `${year}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`
}

/** Friendly Lagos date, e.g. "Friday, 28 February 2026". Accepts a Date, ISO string or 'YYYY-MM-DD'. */
export function formatLagosDate(value: Date | string, style: 'long' | 'medium' = 'long'): string {
  const date = typeof value === 'string' && YMD.test(value) ? lagosYmdToDate(value) : new Date(value)
  const options: Intl.DateTimeFormatOptions
    = style === 'long'
      ? { timeZone: LAGOS_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { timeZone: LAGOS_TZ, day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat('en-NG', options).format(date)
}

export function formatLagosDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: LAGOS_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}
