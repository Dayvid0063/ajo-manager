// app/utils/status.js
// One place for how each status looks: plain-language label, icon and token
// classes. Class strings are written out in full so Tailwind can detect them.
// A status is never shown by color alone — always icon + label.

export const STATUS_STYLES = {
  upcoming: {
    label: 'Coming up',
    icon: 'i-lucide-calendar',
    classes: 'text-status-upcoming bg-status-upcoming-soft border-status-upcoming/40 border-solid'
  },
  due: {
    label: 'Due — please pay',
    icon: 'i-lucide-bell-ring',
    classes: 'text-status-due bg-status-due-soft border-status-due/40 border-solid'
  },
  submitted: {
    // A member's claim — NOT proof of payment until confirmed. Dashed on purpose.
    label: 'Awaiting confirmation',
    icon: 'i-lucide-hourglass',
    classes: 'text-status-submitted bg-status-submitted-soft border-status-submitted border-dashed'
  },
  confirmed: {
    label: 'Confirmed',
    icon: 'i-lucide-circle-check',
    classes: 'text-status-confirmed bg-status-confirmed-soft border-status-confirmed/40 border-solid'
  },
  overdue: {
    label: 'Overdue',
    icon: 'i-lucide-clock-alert',
    classes: 'text-status-overdue bg-status-overdue-soft border-status-overdue/40 border-solid'
  },
  rejected: {
    label: 'Not confirmed — see reason',
    icon: 'i-lucide-circle-x',
    classes: 'text-status-rejected bg-status-rejected-soft border-status-rejected/40 border-solid'
  },
  disputed: {
    label: 'In dispute',
    icon: 'i-lucide-flag',
    classes: 'text-status-disputed bg-status-disputed-soft border-status-disputed/40 border-solid'
  },
  fee: {
    label: 'Platform fee',
    icon: 'i-lucide-receipt',
    classes: 'text-status-fee bg-status-fee-soft border-status-fee/40 border-solid'
  },
  payout: {
    label: 'Your payout',
    icon: 'i-lucide-gift',
    classes: 'text-status-payout bg-status-payout-soft border-status-payout/40 border-solid'
  }
}

export function getStatusStyle(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.upcoming
}
