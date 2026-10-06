// server/services/storage.ts
// Private Cloudflare R2 bucket (S3-compatible) for payment evidence.
// The bucket is never public: the browser uploads with a short-lived signed
// PUT URL, and files are viewed through a short-lived signed GET URL that is
// only issued after an authorization check.
import { randomUUID } from 'node:crypto'
import { AwsClient } from 'aws4fetch'

export interface R2Config {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string // https://<account_id>.r2.cloudflarestorage.com
}

export interface Storage {
  configured: boolean
  presignPut(key: string, contentType: string, expiresSeconds?: number): Promise<string>
  presignGet(key: string, expiresSeconds?: number): Promise<string>
  exists(key: string): Promise<boolean>
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf'
}

/** evidence/<purpose>/<targetId>/<uuid>.<ext> — the target id ties a file to one obligation or group. */
export function evidenceKeyFor(purpose: 'contribution' | 'fee', targetId: string, contentType: string) {
  const ext = EXTENSIONS[contentType]
  if (!ext) throw new Error(`Unsupported content type ${contentType}`)
  return `evidence/${purpose}/${targetId}/${randomUUID()}.${ext}`
}

/** A key may only be attached to the obligation/group it was issued for. */
export function evidenceKeyBelongsTo(key: string, purpose: 'contribution' | 'fee', targetId: string) {
  return key.startsWith(`evidence/${purpose}/${targetId}/`)
}

export function createStorage(config: R2Config): Storage {
  const configured = !!(config.accessKeyId && config.secretAccessKey && config.bucket && config.endpoint && !config.endpoint.includes('<'))
  const client = configured
    ? new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, service: 's3', region: 'auto' })
    : null

  function objectUrl(key: string, expiresSeconds?: number) {
    const url = new URL(`${config.endpoint.replace(/\/$/, '')}/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`)
    if (expiresSeconds) url.searchParams.set('X-Amz-Expires', String(expiresSeconds))
    return url.toString()
  }

  function requireClient() {
    if (!client) throw new Error('Storage is not configured')
    return client
  }

  return {
    configured,
    async presignPut(key, contentType, expiresSeconds = 300) {
      const signed = await requireClient().sign(
        new Request(objectUrl(key, expiresSeconds), { method: 'PUT', headers: { 'content-type': contentType } }),
        { aws: { signQuery: true } }
      )
      return signed.url
    },
    async presignGet(key, expiresSeconds = 60) {
      const signed = await requireClient().sign(new Request(objectUrl(key, expiresSeconds), { method: 'GET' }), { aws: { signQuery: true } })
      return signed.url
    },
    async exists(key) {
      const response = await requireClient().fetch(objectUrl(key), { method: 'HEAD' })
      return response.ok
    }
  }
}

/** Test/dev stand-in: "configured", remembers which keys were "uploaded". */
export function createMemoryStorage(): Storage & { uploaded: Set<string> } {
  const uploaded = new Set<string>()
  return {
    configured: true,
    uploaded,
    async presignPut(key) {
      return `memory://put/${key}`
    },
    async presignGet(key) {
      return `memory://get/${key}`
    },
    async exists(key) {
      return uploaded.has(key)
    }
  }
}
