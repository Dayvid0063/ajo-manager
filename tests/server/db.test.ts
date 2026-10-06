// tests/server/db.test.ts
// Proves the transaction helper really commits/rolls back on a replica set —
// the same setup as local Docker (rs0) and Atlas.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { connectDb, isDbConnected, withTransaction } from '../../server/utils/db'

let replSet: MongoMemoryReplSet
const Thing = mongoose.model('TestThing', new mongoose.Schema({ name: String }, { timestamps: true }))

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await connectDb(replSet.getUri())
  await Thing.createCollection()
})

afterAll(async () => {
  await mongoose.disconnect()
  await replSet?.stop()
})

describe('database', () => {
  it('connects', () => {
    expect(isDbConnected()).toBe(true)
  })

  it('commits all writes in a transaction', async () => {
    await withTransaction(async (session) => {
      await Thing.create([{ name: 'a' }, { name: 'b' }], { session, ordered: true })
    })
    expect(await Thing.countDocuments({ name: { $in: ['a', 'b'] } })).toBe(2)
  })

  it('rolls back every write when one step fails', async () => {
    await expect(
      withTransaction(async (session) => {
        await Thing.create([{ name: 'rolled-back' }], { session })
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(await Thing.countDocuments({ name: 'rolled-back' })).toBe(0)
  })
})
