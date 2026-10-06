// app/utils/labels.js
// Plain-language labels for stored values, plus which StatusChip look to use.

export const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  monthly: 'Monthly'
}

export const FREQUENCY_PERIOD = {
  weekly: 'week',
  monthly: 'month'
}

export const POSITION_METHOD_LABELS = {
  admin_assigns: {
    title: 'The owner or admins assign positions',
    description: 'You decide who collects first, second and so on.'
  },
  members_pick: {
    title: 'Members pick from open slots',
    description: 'Each member chooses a free position, first come, first served.'
  },
  random: {
    title: 'The app draws positions at random',
    description: 'A fair random draw when the group is ready.'
  }
}

/** Group status → StatusChip status + label */
export const GROUP_STATUS_CHIPS = {
  draft: { status: 'upcoming', label: 'Setting up' },
  awaiting_members: { status: 'submitted', label: 'Inviting members' },
  active: { status: 'confirmed', label: 'Active' },
  completed: { status: 'confirmed', label: 'Completed' },
  cancelled: { status: 'rejected', label: 'Cancelled' }
}

/** Group fee status → StatusChip status + label */
export const FEE_STATUS_CHIPS = {
  unpaid: { status: 'due', label: 'Platform fee not paid' },
  pending: { status: 'submitted', label: 'Fee awaiting verification' },
  confirmed: { status: 'fee', label: 'Platform fee confirmed' },
  rejected: { status: 'rejected', label: 'Fee not confirmed' }
}

export const METHOD_LABELS = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  other: 'Other'
}

export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member'
}
