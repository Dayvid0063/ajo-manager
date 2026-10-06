// server/services/audit.ts
// The only way to write audit entries. Pass the transaction session when the
// audited change is part of a transaction, so both commit or neither does.
import type { ClientSession, Types } from 'mongoose'
import { AuditLog } from '../models/audit-log'

type Id = Types.ObjectId | string

export interface AuditEntry {
  actor: Id | null
  action: string
  entityType: string
  entityId: Id
  group?: Id
  before?: unknown
  after?: unknown
  reason?: string
  correlationId?: string
}

export async function recordAudit(entry: AuditEntry, session?: ClientSession) {
  const [doc] = await AuditLog.create([entry], { session })
  return doc
}
