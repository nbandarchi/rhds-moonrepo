import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      experimentalAstAwareRemapping: true,
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        'src/index.ts',
        '**/*.config.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'coverage-istanbul/**',
        'test/**',
        '**/auditor.ts',
      ],
    },
  },
})
