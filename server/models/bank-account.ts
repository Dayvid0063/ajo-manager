// server/models/bank-account.ts
// Where a member wants to receive their payout, per group membership.
// Shown only to authorized people (brief §4.12) and never in notifications.
// Never store bank-login details or card numbers here.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const bankAccountSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    member: { type: Schema.Types.ObjectId, ref: 'GroupMember' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    accountName: { type: String, trim: true }
  },
  { timestamps: true, collection: 'bank_accounts' }
)

bankAccountSchema.index({ member: 1 })

export type BankAccountDoc = InferSchemaType<typeof bankAccountSchema>

export const BankAccount
  = (mongoose.models.BankAccount as Model<BankAccountDoc>) || mongoose.model<BankAccountDoc>('BankAccount', bankAccountSchema)
