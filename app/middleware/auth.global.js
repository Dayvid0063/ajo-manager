// app/middleware/auth.global.js
// Route guard for the UI only — the server enforces every rule on its own.

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/design']
const GUEST_ONLY_ROUTES = ['/', '/login', '/register', '/forgot-password']

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (!loggedIn.value) {
    if (PUBLIC_ROUTES.includes(to.path)) return
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // A temporary password must be changed before anything else
  if (user.value?.mustChangePassword) {
    if (to.path !== '/change-password') return navigateTo('/change-password')
    return
  }

  if (GUEST_ONLY_ROUTES.includes(to.path)) {
    return navigateTo('/home')
  }

  // New accounts finish their profile first
  if (!user.value?.name && to.path !== '/profile/setup') {
    return navigateTo('/profile/setup')
  }

  if (to.path.startsWith('/admin') && !user.value?.isPlatformAdmin) {
    return navigateTo('/home')
  }
})
