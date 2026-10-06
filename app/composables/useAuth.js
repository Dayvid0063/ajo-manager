// app/composables/useAuth.js
// Thin wrapper over nuxt-auth-utils' useUserSession for our auth API.

export function useAuth() {
  const { loggedIn, user, fetch: refreshSession, clear } = useUserSession()

  async function login(data) {
    await $fetch('/api/auth/login', { method: 'POST', body: data })
    await refreshSession()
  }

  async function register(data) {
    await $fetch('/api/auth/register', { method: 'POST', body: data })
    await refreshSession()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    await navigateTo('/login')
  }

  return { loggedIn, user, login, register, logout, refreshSession }
}

/** Only allow same-site relative redirects (prevents open-redirects via ?redirect=). */
export function safeRedirect(target, fallback = '/home') {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : fallback
}
