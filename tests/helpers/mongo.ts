// tests/helpers/mongo.ts
// Starts an in-memory MongoDB replica set (transactions work, like rs0/Atlas)
// for one test file. Vitest isolates files, so each gets its own database.
import { afterAll, beforeAll } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { connectDb } from '../../server/utils/db'

export function useTestDatabase() {
  let replSet: MongoMemoryReplSet

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
    await connectDb(replSet.getUri())
    // Build unique indexes before tests rely on them
    await Promise.all(Object.values(mongoose.models).map(model => model.syncIndexes()))
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await replSet?.stop()
  })
}
