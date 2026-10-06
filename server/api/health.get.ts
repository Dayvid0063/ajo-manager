// server/api/health.get.ts
// Liveness + database check. Used locally and by Railway health checks.
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  let db: 'ok' | 'down' = 'down'
  if (isDbConnected()) {
    try {
      await mongoose.connection.db?.admin().ping()
      db = 'ok'
    } catch {
      db = 'down'
    }
  }

  if (db !== 'ok') {
    setResponseStatus(event, 503)
  }

  return {
    status: db === 'ok' ? 'ok' : 'degraded',
    db,
    time: new Date().toISOString()
  }
})
