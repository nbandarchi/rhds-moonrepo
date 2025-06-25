import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../configs/vitest.config.base'

export default defineConfig(
  mergeConfig(baseConfig, {
    test: {
      globalSetup: './src/testing/auditor.ts',
    },
  })
)
