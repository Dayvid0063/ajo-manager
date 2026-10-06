// shared/utils/money.ts
// All money is stored as integer kobo (₦1 = 100 kobo). Never use floats for amounts.

export const KOBO_PER_NAIRA = 100

export function isValidKobo(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Convert a naira amount typed by a user (e.g. "20,000" or 20000.5) into integer kobo. */
export function nairaToKobo(naira: number | string): number {
  const cleaned = typeof naira === 'string' ? naira.replace(/[₦,\s]/g, '') : String(naira)
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Invalid naira amount: ${naira}`)
  }
  const [whole = '0', fraction = ''] = cleaned.split('.')
  const kobo = Number(whole) * KOBO_PER_NAIRA + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(kobo)) {
    throw new Error(`Amount too large: ${naira}`)
  }
  return kobo
}

/** Format kobo as naira for display: 2000000 → "₦20,000", 2000050 → "₦20,000.50". */
export function formatKobo(kobo: number): string {
  if (!isValidKobo(kobo)) {
    throw new Error(`Invalid kobo amount: ${kobo}`)
  }
  const whole = Math.floor(kobo / KOBO_PER_NAIRA)
  const fraction = kobo % KOBO_PER_NAIRA
  const wholeText = whole.toLocaleString('en-NG')
  return fraction === 0 ? `₦${wholeText}` : `₦${wholeText}.${String(fraction).padStart(2, '0')}`
}
