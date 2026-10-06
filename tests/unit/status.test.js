// tests/unit/status.test.js
import { describe, expect, it } from 'vitest'
import { DISPLAY_STATUS } from '#shared/constants'
import { getStatusStyle, STATUS_STYLES } from '~/utils/status'

describe('status styles', () => {
  it('every display status has a label, icon and classes', () => {
    for (const status of DISPLAY_STATUS) {
      const style = STATUS_STYLES[status]
      expect(style, status).toBeDefined()
      expect(style.label).toBeTruthy()
      expect(style.icon).toMatch(/^i-lucide-/)
      expect(style.classes).toContain(`text-status-${status}`)
    }
  })

  it('a submitted claim looks different from a confirmed payment', () => {
    expect(STATUS_STYLES.submitted.classes).toContain('border-dashed')
    expect(STATUS_STYLES.confirmed.classes).not.toContain('border-dashed')
  })

  it('the platform fee has its own style', () => {
    expect(STATUS_STYLES.fee.classes).toContain('text-status-fee')
  })

  it('falls back safely for unknown statuses', () => {
    expect(getStatusStyle('whatever')).toBe(STATUS_STYLES.upcoming)
  })
})
