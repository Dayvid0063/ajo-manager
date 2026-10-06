// vitest.config.ts
// Plain Vitest for pure logic (shared/, server/utils, app/utils) and for
// database tests against an in-memory MongoDB replica set.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  test: {
    include: ['tests/**/*.test.{ts,js}'],
    environment: 'node',
    // In-memory MongoDB may need to download its binary on the first run
    hookTimeout: 120_000,
    testTimeout: 30_000
  }
})
