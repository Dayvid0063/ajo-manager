// server/models/rule-acceptance.ts
// A member accepting one specific version of the group rules.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const ruleAcceptanceSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    member: { type: Schema.Types.ObjectId, ref: 'GroupMember' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    ruleVersion: { type: Number },
    acceptedAt: { type: Date }
  },
  { timestamps: true, collection: 'rule_acceptances' }
)

ruleAcceptanceSchema.index({ group: 1, ruleVersion: 1, member: 1 })

export type RuleAcceptanceDoc = InferSchemaType<typeof ruleAcceptanceSchema>

export const RuleAcceptance
  = (mongoose.models.RuleAcceptance as Model<RuleAcceptanceDoc>)
    || mongoose.model<RuleAcceptanceDoc>('RuleAcceptance', ruleAcceptanceSchema)
