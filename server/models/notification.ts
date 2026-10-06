// server/models/notification.ts
// Channel-ready (brief §14): only 'in_app' is used in v1; push/email/SMS can be
// added later as more channels without changing this shape.
// NEVER put bank details in title/body.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String },
    title: { type: String },
    body: { type: String },
    data: { type: Schema.Types.Mixed }, // e.g. { groupId, link }
    channel: { type: String, default: 'in_app' },
    readAt: { type: Date }
  },
  { timestamps: true, collection: 'notifications' }
)

notificationSchema.index({ user: 1, createdAt: -1 })
notificationSchema.index({ user: 1, readAt: 1 })

export type NotificationDoc = InferSchemaType<typeof notificationSchema>

export const Notification
  = (mongoose.models.Notification as Model<NotificationDoc>)
    || mongoose.model<NotificationDoc>('Notification', notificationSchema)
