// tests/server/db.test.ts
// Proves the transaction helper really commits/rolls back on a replica set —
// the same setup as local Docker (rs0) and Atlas.
import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { isDbConnected, withTransaction } from '../../server/utils/db'
import { useTestDatabase } from '../helpers/mongo'

const Thing = mongoose.model('TestThing', new mongoose.Schema({ name: String }, { timestamps: true }))

useTestDatabase()

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
