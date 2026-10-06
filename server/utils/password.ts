// server/utils/password.ts
// argon2id hashing (brief §16) and temporary-password generation.
import { randomInt } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'

export function hashUserPassword(plain: string): Promise<string> {
  return hash(plain)
}

export async function verifyUserPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | null = null

/** Burn the same time as a real check when the email doesn't exist (no user enumeration by timing). */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hash('dummy-password-for-timing-only')
  await verifyUserPassword(await dummyHash, plain)
  return false
}

// No look-alike characters (0/O, 1/l/I) — users may read it over the phone
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function generateTemporaryPassword(length = 12): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]
  }
  return out
}
