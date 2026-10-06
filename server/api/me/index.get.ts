// server/api/me/index.get.ts
// The current user's own profile (fresh from the database).
import { User } from '../../models/user'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event, { allowPasswordChange: true })
  const user = await User.findById(sessionUser.id)
    .select('email name phone isPlatformAdmin profileCompletedAt createdAt')
    .lean()
  if (!user) {
    throw notFound()
  }
  return {
    id: String(user._id),
    email: user.email,
    name: user.name ?? '',
    phone: user.phone ?? '',
    isPlatformAdmin: user.isPlatformAdmin === true,
    profileCompleted: !!user.profileCompletedAt,
    createdAt: user.createdAt
  }
})
