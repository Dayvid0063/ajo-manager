// shared/types/auth.d.ts
// Shape of the session stored in the sealed cookie by nuxt-auth-utils.
// `user` is readable by the client — keep it small and non-sensitive.
// `secure` is server-only.
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    isPlatformAdmin: boolean
    mustChangePassword: boolean
  }

  interface SecureSessionData {
    // Must match users.sessionVersion; bumping it logs out every device
    sessionVersion: number
  }
}

export {}
