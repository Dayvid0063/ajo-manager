// server/models/round.ts
// One payout round. Created only by the schedule engine at activation.
// Unique (group, index) stops a round being created twice.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const roundSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    index: { type: Number }, // 1-based, equals the recipient's payout position
    recipientMember: { type: Schema.Types.ObjectId, ref: 'GroupMember' },
    recipientUser: { type: Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date }, // 00:00 Lagos
    expectedPayout: { type: Number }, // kobo
    status: { type: String, default: 'upcoming' } // upcoming | current | completed
  },
  { timestamps: true, collection: 'rounds' }
)

roundSchema.index({ group: 1, index: 1 }, { unique: true })
roundSchema.index({ recipientUser: 1, dueDate: 1 })

export type RoundDoc = InferSchemaType<typeof roundSchema>

export const Round = (mongoose.models.Round as Model<RoundDoc>) || mongoose.model<RoundDoc>('Round', roundSchema)
