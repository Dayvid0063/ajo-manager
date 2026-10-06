// server/models/contribution-record.ts
// One "Mark as paid" claim. A claim is NOT proof of payment until the
// recipient or an admin confirms it. Records are never edited after review:
// a rejected claim stays rejected and the member submits a new one.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const contributionRecordSchema = new Schema(
  {
    obligation: { type: Schema.Types.ObjectId, ref: 'Obligation' },
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    round: { type: Schema.Types.ObjectId, ref: 'Round' },
    contributorMember: { type: Schema.Types.ObjectId, ref: 'GroupMember' },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number }, // kobo
    paymentDate: { type: Date }, // 00:00 Lagos
    method: { type: String }, // bank_transfer | cash | other
    reference: { type: String },
    evidenceKey: { type: String }, // private R2 object key
    note: { type: String },
    status: { type: String, default: 'submitted' }, // submitted | confirmed | rejected
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String }
  },
  { timestamps: true, collection: 'contribution_records' }
)

contributionRecordSchema.index({ obligation: 1, createdAt: -1 })
contributionRecordSchema.index({ group: 1, status: 1 })

export type ContributionRecordDoc = InferSchemaType<typeof contributionRecordSchema>

export const ContributionRecord
  = (mongoose.models.ContributionRecord as Model<ContributionRecordDoc>)
    || mongoose.model<ContributionRecordDoc>('ContributionRecord', contributionRecordSchema)
