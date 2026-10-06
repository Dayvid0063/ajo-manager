// server/models/group-member.ts
// Unique (group, user) and unique (group, position). The position index is
// partial so the many members without a position yet don't clash on null.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const groupMemberSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, default: 'member' }, // owner | admin | member
    status: { type: String, default: 'pending' }, // pending | approved | rejected | removed
    position: { type: Number },
    positionAcceptedAt: { type: Date },
    joinedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, collection: 'group_members' }
)

groupMemberSchema.index({ group: 1, user: 1 }, { unique: true })
groupMemberSchema.index(
  { group: 1, position: 1 },
  { unique: true, partialFilterExpression: { position: { $type: 'number' } } }
)
groupMemberSchema.index({ user: 1, status: 1 })

export type GroupMemberDoc = InferSchemaType<typeof groupMemberSchema>

export const GroupMember
  = (mongoose.models.GroupMember as Model<GroupMemberDoc>) || mongoose.model<GroupMemberDoc>('GroupMember', groupMemberSchema)
