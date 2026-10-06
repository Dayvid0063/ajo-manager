// scripts/check-db.mjs
// Checks that a MongoDB connection string works (e.g. a new Atlas cluster)
// before using it on Railway. Nothing is written to the database, and the
// connection string is never saved. Only the cluster address (not the
// username or password) is printed, to help spot typos.
//
//   npm run db:check                 (it asks you to paste the connection string)
//   npm run db:check -- "<uri>"      (or pass it directly)
import dns from 'node:dns'
import { createInterface } from 'node:readline/promises'
import mongoose from 'mongoose'

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1']

async function askForUri() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('Paste your MongoDB connection string and press Enter:\n> ')
  rl.close()
  return answer.trim().replace(/^["']|["']$/g, '')
}

/** The part between the last "@" and the first "/" — the cluster address. */
function clusterHost(uri) {
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '')
  const afterCredentials = withoutScheme.slice(withoutScheme.lastIndexOf('@') + 1)
  return afterCredentials.split(/[/?]/)[0]
}

function credentialProblems(uri) {
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '')
  const problems = []
  if ((withoutScheme.match(/@/g) ?? []).length > 1) {
    problems.push('Your password seems to contain "@". Create a new password with only letters and numbers in Atlas → Database Access → Edit.')
  }
  if (/<password>|<db_password>/i.test(uri)) {
    problems.push('The connection string still contains <password> / <db_password>. Replace it (including the < >) with the real password.')
  }
  return problems
}

async function srvLookup(host, servers) {
  const resolver = new dns.promises.Resolver({ timeout: 8000, tries: 2 })
  if (servers) resolver.setServers(servers)
  try {
    const records = await resolver.resolveSrv(`_mongodb._tcp.${host}`)
    return { ok: records.length > 0 }
  } catch (error) {
    return { ok: false, code: error.code }
  }
}

function explain(error) {
  const message = String(error?.message ?? error)
  if (/bad auth|authentication failed/i.test(message)) return 'Wrong username or password. Check the database user in Atlas → Database Access. Use a password with only letters and numbers.'
  if (/timed out|Server selection|ECONNREFUSED|ETIMEDOUT/i.test(message)) return 'Could not reach the cluster. In Atlas → Network Access, add 0.0.0.0/0 (wait about a minute after adding it), and check your internet connection.'
  if (/Invalid scheme|Invalid connection string|URI/i.test(message)) return 'That doesn\'t look like a valid connection string. It should start with mongodb+srv:// or mongodb://'
  return 'See the technical detail below.'
}

async function tryConnect(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 })
  const db = mongoose.connection.db
  await db.admin().ping()
  const hello = await db.admin().command({ hello: 1 })
  return { databaseName: db.databaseName, setName: hello.setName }
}

function report(result) {
  console.log('\n✅ Connected successfully.')
  console.log(`   Database name: ${result.databaseName}`)
  console.log(`   Replica set:   ${result.setName ? `yes (${result.setName}) — transactions will work` : 'NO — transactions will not work'}`)
  if (result.databaseName === 'test') {
    console.log('\n⚠️  The database name is "test". Add /ajo-manager after .mongodb.net in the connection string, e.g.')
    console.log('   mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/ajo-manager?retryWrites=true&w=majority')
  }
  if (!result.setName) process.exitCode = 1
}

// ── Run ───────────────────────────────────────────────────────────────────

const uri = (process.argv[2] ?? '').trim() || await askForUri()
if (!uri) {
  console.error('\nNo connection string given.')
  process.exit(1)
}

const host = clusterHost(uri)
console.log(`\nCluster address: ${host}`)
for (const problem of credentialProblems(uri)) console.log(`⚠️  ${problem}`)

// mongodb+srv:// needs a special DNS lookup — check it separately so we can say exactly what's wrong
let usePublicDns = false
if (uri.startsWith('mongodb+srv://')) {
  const system = await srvLookup(host)
  if (!system.ok) {
    const viaPublic = await srvLookup(host, PUBLIC_DNS)
    if (viaPublic.ok) {
      usePublicDns = true
      console.log('\n⚠️  Your internet provider\'s DNS could not look up this cluster, but Google/Cloudflare DNS can.')
      console.log('   This only affects your computer — Railway\'s network will be fine.')
      console.log('   Retrying the connection using public DNS…')
    } else {
      console.error('\n❌ The cluster address could not be found, even with public DNS.')
      console.error(`   Check it matches Atlas exactly (Database → Connect → Drivers): ${host}`)
      console.error(`   (lookup error: ${system.code ?? 'unknown'} / ${viaPublic.code ?? 'unknown'})`)
      process.exit(1)
    }
  }
}
if (usePublicDns) dns.setServers(PUBLIC_DNS)

console.log('\nConnecting…')
try {
  report(await tryConnect(uri))
} catch (error) {
  console.error(`\n❌ Could not connect.\n   ${explain(error)}`)
  // Never print the URI itself; strip anything that looks like credentials from the message
  console.error(`   Technical detail: ${String(error?.message ?? error).replace(/\/\/[^@\s]+@/g, '//***@')}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect().catch(() => {})
}
