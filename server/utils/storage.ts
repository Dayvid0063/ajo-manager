// server/utils/storage.ts
// The R2 storage client built from runtime config (NUXT_R2_*).
import { createStorage, type Storage } from '../services/storage'

let cached: Storage | null = null

export function storage(): Storage {
  if (!cached) {
    const { r2 } = useRuntimeConfig()
    cached = createStorage({
      accessKeyId: String(r2?.accessKeyId ?? ''),
      secretAccessKey: String(r2?.secretAccessKey ?? ''),
      bucket: String(r2?.bucket ?? ''),
      endpoint: String(r2?.endpoint ?? '')
    })
  }
  return cached
}
