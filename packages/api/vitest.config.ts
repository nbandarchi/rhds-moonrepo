import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../configs/vitest.config.base'

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      globalSetup: ['./test/globals/setup.ts'],
      coverage: {
        exclude: ['src/api-test-helpers/audit/openapi-auditor.ts'],
      },
    },
  })
)
