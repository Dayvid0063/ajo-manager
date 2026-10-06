// server/models/group.ts
// Single cycle folded into the group for v1 (brief §15). No model-level
// enums/required — the API validates. Only DB constraint: unique inviteCode.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const groupSchema = new Schema(
  {
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    imageKey: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },

    // Contribution settings
    contributionAmount: { type: Number }, // kobo
    frequency: { type: String }, // weekly | monthly
    startDate: { type: Date }, // 00:00 Lagos on the first due date
    plannedMemberCount: { type: Number },
    recipientContributes: { type: Boolean },

    // Payout settings
    positionMethod: { type: String }, // admin_assigns | members_pick | random
    recipientCanConfirm: { type: Boolean, default: true },

    // Lifecycle — changed only by server services (docs/state-machines.md)
    status: { type: String, default: 'draft' },
    feeStatus: { type: String, default: 'unpaid' }, // unpaid | pending | confirmed | rejected
    // Approved members, kept in step inside transactions. Approvals update this
    // field conditionally so two simultaneous approvals can't overfill the group.
    approvedMemberCount: { type: Number, default: 1 },
    inviteCode: { type: String },
    invitesEnabled: { type: Boolean, default: false },
    activatedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date }
  },
  { timestamps: true, collection: 'groups' }
)

groupSchema.index({ inviteCode: 1 }, { unique: true })
groupSchema.index({ owner: 1, createdAt: -1 })

export type GroupDoc = InferSchemaType<typeof groupSchema>

export const Group = (mongoose.models.Group as Model<GroupDoc>) || mongoose.model<GroupDoc>('Group', groupSchema)
