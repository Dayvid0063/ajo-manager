// server/models/management-fee.ts
// One fee record per group (unique index, brief §6). A rejected fee is
// re-reported on the same record; earlier attempts are kept in `attempts`.
// No money is handled here — this only records a bank transfer made outside the app.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const attemptSchema = new Schema(
  {
    senderName: String,
    transferDate: Date,
    transferReference: String,
    note: String,
    evidenceKey: String,
    reportedAt: Date,
    rejectedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String
  },
  { _id: false }
)

const managementFeeSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    amount: { type: Number }, // kobo, copied from config when reported
    paymentReference: { type: String }, // what the owner should put in the transfer narration
    status: { type: String }, // pending | confirmed | rejected

    // Current report
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reportedAt: { type: Date },
    senderName: { type: String },
    transferDate: { type: Date },
    transferReference: { type: String },
    note: { type: String },
    evidenceKey: { type: String }, // private R2 object key (optional screenshot of the transfer)

    // Review
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },

    attempts: { type: [attemptSchema], default: [] }
  },
  { timestamps: true, collection: 'management_fees' }
)

managementFeeSchema.index({ group: 1 }, { unique: true })
managementFeeSchema.index({ status: 1, reportedAt: 1 })

export type ManagementFeeDoc = InferSchemaType<typeof managementFeeSchema>

export const ManagementFee
  = (mongoose.models.ManagementFee as Model<ManagementFeeDoc>)
    || mongoose.model<ManagementFeeDoc>('ManagementFee', managementFeeSchema)
