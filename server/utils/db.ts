// server/utils/db.ts
// Single shared Mongoose connection. Mongo must run as a replica set (local
// Docker rs0 or Atlas) so multi-document transactions work.
import mongoose from 'mongoose'

let connecting: Promise<typeof mongoose> | null = null

export function connectDb(uri: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose)
  }
  if (!connecting) {
    if (!uri) {
      throw new Error('NUXT_MONGODB_URI is not set')
    }
    mongoose.set('strictQuery', true)
    connecting = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true })
      .catch((error) => {
        connecting = null
        throw error
      })
  }
  return connecting
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1
}

/**
 * Run `work` inside a MongoDB transaction. Use for every multi-write operation
 * that must succeed or fail as a whole (fee verification, activation, confirmations).
 */
export async function withTransaction<T>(work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession()
  try {
    let result: T | undefined
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result as T
  } finally {
    await session.endSession()
  }
}
