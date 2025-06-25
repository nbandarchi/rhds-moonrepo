import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import {
  createDrizzleConfig,
  type DrizzleConfigOptions,
} from '../../src/db/drizzle-config'

describe('createDrizzleConfig', () => {
  // Store a deep copy of the original process.env
  const originalEnv = JSON.parse(JSON.stringify(process.env))

  const mockBaseEnv = {
    // biome-ignore lint/style/useNamingConvention: Match env var naming convention
    POSTGRES_USER: 'testuser',
    // biome-ignore lint/style/useNamingConvention: Match env var naming convention
    POSTGRES_PASSWORD: 'testpassword',
    // biome-ignore lint/style/useNamingConvention: Match env var naming convention
    POSTGRES_DB: 'testdb',
    // biome-ignore lint/style/useNamingConvention: Match env var naming convention
    PROJECT_SCHEMA: 'my_project_schema',
  }

  const mockFullEnv = {
    ...mockBaseEnv,
    // biome-ignore lint/style/useNamingConvention: Match env var naming convention
    POSTGRES_HOST: 'testhost',
    // biome-ignore lint/style/useNamingConvention: Match env var naming convention
    POSTGRES_PORT: '1234',
  }

  const defaultOptions: DrizzleConfigOptions = {
    schemaPath: './src/db/schema.ts',
  }

  beforeEach(() => {
    // Reset process.env to a clean slate based on mockFullEnv for most tests
    // Individual tests can override this if they need specific env setups
    process.env = { ...originalEnv, ...mockFullEnv }
    vi.resetModules() // Ensures module re-imports fresh state if it reads env at top level
  })

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv
    vi.restoreAllMocks() // Clean up all Vitest mocks
    vi.resetModules() // Clean up module cache
  })

  it('should create a valid Drizzle config with all required options and explicit env vars', () => {
    const config = createDrizzleConfig(defaultOptions)
    expect(config).toEqual({
      schema: defaultOptions.schemaPath,
      out: './drizzle', // Default outDir
      dialect: 'postgresql',
      dbCredentials: {
        url: `postgres://${mockFullEnv.POSTGRES_USER}:${mockFullEnv.POSTGRES_PASSWORD}@${mockFullEnv.POSTGRES_HOST}:${mockFullEnv.POSTGRES_PORT}/${mockFullEnv.POSTGRES_DB}?schema=${mockFullEnv.PROJECT_SCHEMA}`,
      },
      schemaFilter: [mockFullEnv.PROJECT_SCHEMA],
    })
  })

  it('should use default values for outDir, POSTGRES_PORT, and POSTGRES_HOST when not provided', () => {
    // Set only the essential DB credentials, omitting host and port to test defaults
    process.env = { ...originalEnv, ...mockBaseEnv }

    const optionsWithoutOutDir = { ...defaultOptions }
    // outDir is optional, so not providing it in options tests its default value in the function

    const config = createDrizzleConfig(optionsWithoutOutDir)
    expect(config).toEqual({
      schema: defaultOptions.schemaPath,
      out: './drizzle', // Default outDir
      dialect: 'postgresql',
      dbCredentials: {
        url: `postgres://${mockBaseEnv.POSTGRES_USER}:${mockBaseEnv.POSTGRES_PASSWORD}@localhost:5432/${mockBaseEnv.POSTGRES_DB}?schema=${mockBaseEnv.PROJECT_SCHEMA}`,
      },
      schemaFilter: [mockBaseEnv.PROJECT_SCHEMA],
    })
  })

  it('should include tablesFilter in the config when provided', () => {
    const optionsWithFilter: DrizzleConfigOptions = {
      ...defaultOptions,
      tablesFilter: ['table1', 'table2'],
    }
    const config = createDrizzleConfig(optionsWithFilter)
    expect(config.tablesFilter).toEqual(['table1', 'table2'])
  })

  it('should use a custom outDir when provided in options', () => {
    const customOutDir = './custom-migrations'
    const optionsWithCustomOutDir: DrizzleConfigOptions = {
      ...defaultOptions,
      outDir: customOutDir,
    }
    const config = createDrizzleConfig(optionsWithCustomOutDir)
    expect(config.out).toBe(customOutDir)
  })

  // Test error conditions for missing environment variables
  const requiredEnvVarKeys: (keyof typeof mockBaseEnv)[] = [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
  ]
  for (const missingVarKey of requiredEnvVarKeys) {
    it(`should throw an error if ${missingVarKey} is missing from environment`, () => {
      delete process.env[missingVarKey]

      expect(() => createDrizzleConfig(defaultOptions)).toThrow(
        `Missing required database environment variables: ${missingVarKey}`
      )
    })
  }

  it('should throw an error if multiple required variables are missing', () => {
    // Completely clear environment and set specific variables
    process.env.POSTGRES_USER = undefined
    process.env.POSTGRES_PASSWORD = undefined
    process.env.POSTGRES_DB = undefined

    expect(() => createDrizzleConfig(defaultOptions)).toThrow(
      'Missing required database environment variables: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB'
    )
  })

  it('should throw an error if PROJECT_SCHEMA is missing from environment', () => {
    process.env.PROJECT_SCHEMA = undefined

    expect(() => createDrizzleConfig(defaultOptions)).toThrow(
      'Missing required environment variable: PROJECT_SCHEMA'
    )
  })
})
