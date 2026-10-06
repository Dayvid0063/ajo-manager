// server/models/user.ts
// No model-level enums/required (brief §6) — the API validates input with Zod.
// Only DB constraint: unique email.
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const userSchema = new Schema(
  {
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    // Never returned unless explicitly selected with '+passwordHash'
    passwordHash: { type: String, select: false },
    isPlatformAdmin: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    // Bumped to invalidate every existing session (password change, temp password)
    sessionVersion: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    profileCompletedAt: { type: Date },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date }
  },
  { timestamps: true, collection: 'users' }
)

userSchema.index({ email: 1 }, { unique: true })

export type UserDoc = InferSchemaType<typeof userSchema>

export const User = (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>('User', userSchema)
