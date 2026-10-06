// server/services/notifications.ts
// Notifications are created only here, from server-side events — never from
// client actions directly (brief §14). v1 renders the 'in_app' channel only.
// RULE: never put bank details in title/body (they show in previews).
import type { ClientSession, Types } from 'mongoose'
import { Notification } from '../models/notification'
import { User } from '../models/user'

type Id = Types.ObjectId | string

export interface NotificationPayload {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function notify(userIds: Id[], payload: NotificationPayload, session?: ClientSession) {
  if (!userIds.length) return
  await Notification.insertMany(
    userIds.map(user => ({ user, ...payload, channel: 'in_app' })),
    { session }
  )
}

export async function notifyPlatformAdmins(payload: NotificationPayload, session?: ClientSession) {
  const admins = await User.find({ isPlatformAdmin: true, status: 'active' }).select('_id').session(session ?? null).lean()
  await notify(admins.map(admin => admin._id), payload, session)
}

export async function listNotifications(userId: string, input: { page: number, limit: number }) {
  const filter = { user: userId, channel: 'in_app' }
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, readAt: null })
  ])
  return {
    items: items.map(item => ({
      id: String(item._id),
      type: item.type,
      title: item.title,
      body: item.body,
      data: item.data ?? {},
      readAt: item.readAt ?? null,
      createdAt: item.createdAt
    })),
    total,
    unread,
    page: input.page,
    limit: input.limit
  }
}

export function unreadCount(userId: string) {
  return Notification.countDocuments({ user: userId, channel: 'in_app', readAt: null })
}

/** Mark specific notifications (or all, when ids is empty) as read — only the caller's own. */
export async function markRead(userId: string, ids: string[]) {
  const filter = ids.length ? { user: userId, _id: { $in: ids }, readAt: null } : { user: userId, readAt: null }
  const result = await Notification.updateMany(filter, { $set: { readAt: new Date() } })
  return { updated: result.modifiedCount }
}
