// server/models/audit-log.ts
// Append-only. There is no update/delete API, and the hooks below refuse
// updates and deletes even from server code.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String },
    correlationId: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' }
)

auditLogSchema.index({ group: 1, createdAt: -1 })
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })

const refuse = () => {
  throw new Error('audit_logs are append-only')
}
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  auditLogSchema.pre(op, refuse)
}

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>

export const AuditLog
  = (mongoose.models.AuditLog as Model<AuditLogDoc>) || mongoose.model<AuditLogDoc>('AuditLog', auditLogSchema)
