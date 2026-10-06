// app/utils/navigation.js
// Main navigation used by the mobile tab bar and the desktop sidebar.

export const MEMBER_NAV = [
  { to: '/home', label: 'Home', icon: 'i-lucide-house' },
  { to: '/groups', label: 'Groups', icon: 'i-lucide-users-round' },
  { to: '/payments', label: 'Payments', icon: 'i-lucide-hand-coins' },
  { to: '/notifications', label: 'Alerts', icon: 'i-lucide-bell' },
  { to: '/profile', label: 'Profile', icon: 'i-lucide-circle-user-round' }
]

export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'i-lucide-layout-dashboard' },
  { to: '/admin/fees', label: 'Fee verification', icon: 'i-lucide-receipt' },
  { to: '/admin/users', label: 'Users', icon: 'i-lucide-users' },
  { to: '/admin/groups', label: 'Groups', icon: 'i-lucide-users-round' },
  { to: '/admin/disputes', label: 'Disputes', icon: 'i-lucide-flag' },
  { to: '/admin/audit', label: 'Audit log', icon: 'i-lucide-scroll-text' }
]
