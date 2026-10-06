// server/models/dispute.ts
// A basic dispute (brief §13). The app keeps the record and the conversation;
// it does not promise debt recovery, repayment or legal enforcement.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const messageSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    authorRole: { type: String }, // member | manager | platform
    body: { type: String },
    createdAt: { type: Date }
  },
  { _id: true }
)

const disputeSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    round: { type: Schema.Types.ObjectId, ref: 'Round' },
    obligation: { type: Schema.Types.ObjectId, ref: 'Obligation' },
    opener: { type: Schema.Types.ObjectId, ref: 'User' },
    category: { type: String },
    description: { type: String },
    evidenceKeys: { type: [String], default: [] },
    status: { type: String, default: 'open' }, // open | under_review | resolved | rejected
    assignee: { type: Schema.Types.ObjectId, ref: 'User' },
    messages: { type: [messageSchema], default: [] },
    resolution: { type: String },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date }
  },
  { timestamps: true, collection: 'disputes' }
)

disputeSchema.index({ group: 1, createdAt: -1 })
disputeSchema.index({ status: 1, createdAt: 1 })
disputeSchema.index({ obligation: 1 })

export type DisputeDoc = InferSchemaType<typeof disputeSchema>

export const Dispute = (mongoose.models.Dispute as Model<DisputeDoc>) || mongoose.model<DisputeDoc>('Dispute', disputeSchema)
