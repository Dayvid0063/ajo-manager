// scripts/seed.ts
// DEVELOPMENT SEED DATA — fake users with a known password. Safe to re-run
// (upserts by email). Refuses to run in production or against Atlas.
//
//   npm run seed
import mongoose from 'mongoose'
import { hash } from '@node-rs/argon2'
import { User } from '../server/models/user.ts'

const uri = process.env.NUXT_MONGODB_URI ?? ''
if (process.env.NODE_ENV === 'production' || uri.startsWith('mongodb+srv://')) {
  console.error('Refusing to seed: this looks like a production / Atlas database.')
  process.exit(1)
}
if (!uri) {
  console.error('NUXT_MONGODB_URI is not set (check .env)')
  process.exit(1)
}

export const SEED_PASSWORD = 'Password123!'

const users = [
  { email: 'admin@ajo.test', name: 'Platform Admin', phone: '', isPlatformAdmin: true },
  { email: 'ada@ajo.test', name: 'Adaeze Okafor', phone: '08031234567', isPlatformAdmin: false },
  { email: 'bola@ajo.test', name: 'Bolanle Adeyemi', phone: '08051234567', isPlatformAdmin: false },
  { email: 'chidi@ajo.test', name: 'Chidi Nwosu', phone: '', isPlatformAdmin: false },
  { email: 'musa@ajo.test', name: 'Musa Ibrahim', phone: '', isPlatformAdmin: false }
]

await mongoose.connect(uri)
try {
  await User.syncIndexes()
  const passwordHash = await hash(SEED_PASSWORD)
  const now = new Date()
  for (const user of users) {
    await User.updateOne(
      { email: user.email },
      {
        $set: { ...user, passwordHash, status: 'active', mustChangePassword: false, passwordChangedAt: now },
        $setOnInsert: { profileCompletedAt: now, sessionVersion: 0 }
      },
      { upsert: true }
    )
  }
  console.info(`Seeded ${users.length} users. Password for all: ${SEED_PASSWORD}`)
  for (const user of users) console.info(`  ${user.email}${user.isPlatformAdmin ? '  (platform admin)' : ''}`)
} finally {
  await mongoose.disconnect()
}
