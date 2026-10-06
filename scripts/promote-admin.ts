// scripts/promote-admin.ts
// Make an existing user a platform admin (or remove it with --revoke).
// The only way to create the first platform admin.
//
//   npm run admin:promote -- someone@example.com             (uses NUXT_MONGODB_URI from .env)
//   npm run admin:promote -- someone@example.com --revoke
//   npm run admin:promote:remote -- someone@example.com      (asks for the connection string, e.g. Atlas)
import { createInterface } from 'node:readline/promises'
import mongoose from 'mongoose'
import { User } from '../server/models/user.ts'
import { prepareDnsFor } from './lib/mongo-dns.mjs'

const args = process.argv.slice(2)
const email = args.find(arg => !arg.startsWith('--'))?.trim().toLowerCase()
const revoke = args.includes('--revoke')

let uri = process.env.NUXT_MONGODB_URI ?? ''
if (args.includes('--ask-uri')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  uri = (await rl.question('Paste the MongoDB connection string for the database to update and press Enter:\n> ')).trim().replace(/^["']|["']$/g, '')
  rl.close()
}

if (!email || !uri) {
  console.error(!email ? 'Usage: npm run admin:promote -- <email> [--revoke]' : 'No connection string (set NUXT_MONGODB_URI in .env, or use admin:promote:remote)')
  process.exit(1)
}

if ((await prepareDnsFor(uri)) === 'public') {
  console.info('(Using public DNS to reach the cluster — your computer\'s DNS could not.)')
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 })
try {
  console.info(`Database: ${mongoose.connection.db?.databaseName}`)
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
