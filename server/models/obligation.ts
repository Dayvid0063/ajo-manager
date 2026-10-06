// server/models/obligation.ts
// What one member is expected to pay in one round. Created only by the
// schedule engine. Unique (round, contributorMember) — never two per member per round.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const obligationSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    round: { type: Schema.Types.ObjectId, ref: 'Round' },
    contributorMember: { type: Schema.Types.ObjectId, ref: 'GroupMember' },
    contributorUser: { type: Schema.Types.ObjectId, ref: 'User' },
    expectedAmount: { type: Number }, // kobo
    dueDate: { type: Date }, // copied from the round for fast "what do I owe" queries
    status: { type: String, default: 'pending' } // pending | submitted | confirmed | rejected | disputed
  },
  { timestamps: true, collection: 'obligations' }
)

obligationSchema.index({ round: 1, contributorMember: 1 }, { unique: true })
obligationSchema.index({ contributorUser: 1, dueDate: 1 })
obligationSchema.index({ group: 1, dueDate: 1 })

export type ObligationDoc = InferSchemaType<typeof obligationSchema>

export const Obligation
  = (mongoose.models.Obligation as Model<ObligationDoc>) || mongoose.model<ObligationDoc>('Obligation', obligationSchema)
