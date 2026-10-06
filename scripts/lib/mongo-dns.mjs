// scripts/lib/mongo-dns.mjs
// Some Windows machines can't do the DNS SRV lookup that mongodb+srv:// needs
// (Node ends up asking 127.0.0.1). For local scripts only: if the system lookup
// fails but public DNS works, switch this process to public DNS.
import dns from 'node:dns'

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1']

function clusterHost(uri) {
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '')
  return withoutScheme.slice(withoutScheme.lastIndexOf('@') + 1).split(/[/?]/)[0]
}

async function srvOk(host, servers) {
  const resolver = new dns.promises.Resolver({ timeout: 8000, tries: 2 })
  if (servers) resolver.setServers(servers)
  try {
    return (await resolver.resolveSrv(`_mongodb._tcp.${host}`)).length > 0
  } catch {
    return false
  }
}

/** Returns 'system', 'public' (switched to public DNS) or 'not-needed'. */
export async function prepareDnsFor(uri) {
  if (!uri.startsWith('mongodb+srv://')) return 'not-needed'
  const host = clusterHost(uri)
  if (await srvOk(host)) return 'system'
  if (await srvOk(host, PUBLIC_DNS)) {
    dns.setServers(PUBLIC_DNS)
    return 'public'
  }
  return 'system' // let the driver report the real error
}
