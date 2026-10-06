// server/plugins/mongoose.ts
// Connect to MongoDB when the server starts. A failed connection is logged, not
// fatal, so /api/health can report the problem instead of the server crashing.
export default defineNitroPlugin(async () => {
  const { mongodbUri } = useRuntimeConfig()
  try {
    await connectDb(mongodbUri)
    console.info('[db] connected to MongoDB')
  } catch (error) {
    console.error('[db] could not connect to MongoDB:', (error as Error).message)
  }
})
