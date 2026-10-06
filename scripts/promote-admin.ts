// scripts/promote-admin.ts
// Make an existing user a platform admin (or remove it with --revoke).
// The only way to create the first platform admin.
//
//   npm run admin:promote -- someone@example.com
//   npm run admin:promote -- someone@example.com --revoke
import mongoose from 'mongoose'
import { User } from '../server/models/user.ts'

const args = process.argv.slice(2)
const email = args.find(arg => !arg.startsWith('--'))?.trim().toLowerCase()
const revoke = args.includes('--revoke')
const uri = process.env.NUXT_MONGODB_URI

if (!email || !uri) {
  console.error(!email ? 'Usage: npm run admin:promote -- <email> [--revoke]' : 'NUXT_MONGODB_URI is not set (check .env)')
  process.exit(1)
}

await mongoose.connect(uri)
try {
  const user = await User.findOneAndUpdate(
    { email },
    // Bump sessionVersion so the change applies to existing sessions immediately
    { $set: { isPlatformAdmin: !revoke }, $inc: { sessionVersion: 1 } },
    { returnDocument: 'after' }
  )
  if (!user) {
    console.error(`No user with email ${email}. Register in the app first.`)
    process.exitCode = 1
  } else {
    console.info(`${email} is ${revoke ? 'no longer' : 'now'} a platform admin. They need to log in again.`)
  }
} finally {
  await mongoose.disconnect()
}
