// shared/types/auth.d.ts
// Shape of the session user stored in the sealed cookie by nuxt-auth-utils.
// Keep it small and non-sensitive — never put bank details or hashes here.
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    isPlatformAdmin: boolean
    mustChangePassword?: boolean
  }
}

export {}
