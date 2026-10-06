// shared/constants/index.ts
// Allowed string values used across client and server. The database does NOT
// enforce these (see brief §6) — the API validates them with Zod.

export const GROUP_STATUS = ['draft', 'awaiting_members', 'active', 'completed', 'cancelled'] as const
export type GroupStatus = (typeof GROUP_STATUS)[number]

export const MEMBER_ROLE = ['owner', 'admin', 'member'] as const
export type MemberRole = (typeof MEMBER_ROLE)[number]

export const MEMBERSHIP_STATUS = ['pending', 'approved', 'rejected', 'removed'] as const
export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[number]

export const FREQUENCY = ['weekly', 'monthly'] as const
export type Frequency = (typeof FREQUENCY)[number]

export const POSITION_METHOD = ['admin_assigns', 'members_pick', 'random'] as const
export type PositionMethod = (typeof POSITION_METHOD)[number]

export const FEE_STATUS = ['pending', 'confirmed', 'rejected'] as const
export type FeeStatus = (typeof FEE_STATUS)[number]

export const ROUND_STATUS = ['upcoming', 'current', 'completed'] as const
export type RoundStatus = (typeof ROUND_STATUS)[number]

/** Stored obligation states. */
export const OBLIGATION_STATUS = ['pending', 'submitted', 'confirmed', 'rejected', 'disputed'] as const
export type ObligationStatus = (typeof OBLIGATION_STATUS)[number]

/** What the UI shows — derived from stored state + dates (see docs/state-machines.md). */
export const DISPLAY_STATUS = [
  'upcoming',
  'due',
  'submitted',
  'confirmed',
  'overdue',
  'rejected',
  'disputed'
] as const
export type DisplayStatus = (typeof DISPLAY_STATUS)[number]

export const RECORD_STATUS = ['submitted', 'confirmed', 'rejected'] as const
export type RecordStatus = (typeof RECORD_STATUS)[number]

export const DISPUTE_STATUS = ['open', 'under_review', 'resolved', 'rejected'] as const
export type DisputeStatus = (typeof DISPUTE_STATUS)[number]

export const DISPUTE_CATEGORY = [
  'payment_not_confirmed',
  'wrong_amount',
  'wrong_recipient_details',
  'duplicate_record',
  'member_misconduct',
  'other'
] as const
export type DisputeCategory = (typeof DISPUTE_CATEGORY)[number]

export const PAYMENT_METHOD = ['bank_transfer', 'cash', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHOD)[number]

export const NOTIFICATION_CHANNEL = ['in_app'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number]

export const TIMEZONE = 'Africa/Lagos'
export const DUE_SOON_DAYS = 3
