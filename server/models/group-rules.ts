// server/models/group-rules.ts
// Versioned rules. Members accept a specific version (Phase 4), so once
// members can see the group, every edit creates a new version.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const groupRulesSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    version: { type: Number },
    body: { type: String },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, collection: 'group_rules' }
)

groupRulesSchema.index({ group: 1, version: -1 })

export type GroupRulesDoc = InferSchemaType<typeof groupRulesSchema>

export const GroupRules
  = (mongoose.models.GroupRules as Model<GroupRulesDoc>) || mongoose.model<GroupRulesDoc>('GroupRules', groupRulesSchema)
