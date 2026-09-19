import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1
  },
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared')
    }
  }
})