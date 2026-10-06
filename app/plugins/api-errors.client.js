// app/plugins/api-errors.client.js
// If the server says the session ended (401) or a temporary password must be
// changed first (403 PASSWORD_CHANGE_REQUIRED), send the user to the right page.
// Auth endpoints are skipped — a 401 from /api/auth/login is just a wrong password.

export default defineNuxtPlugin(() => {
  const { fetch: refreshSession, clear } = useUserSession()

  globalThis.$fetch = $fetch.create({
    async onResponseError({ request, response }) {
      const url = typeof request === 'string' ? request : request.url
      if (url.includes('/api/auth/') || url.includes('/api/_auth/')) return

      if (response.status === 401) {
        await clear()
        await navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } })
      } else if (response.status === 403 && response._data?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
        await refreshSession()
        await navigateTo('/change-password')
      }
    }
  })
})
