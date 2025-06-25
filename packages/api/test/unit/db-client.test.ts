import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  vi,
  beforeAll,
} from 'vitest'
import { createDbClient } from '../../src/db/client'
import { pgTable, uuid, text } from 'drizzle-orm/pg-core'

// Create a test table schema for testing
const testTable = pgTable('test_table', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
})

const testSchema = { testTable }

describe('createDbClient', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env }
  })

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('Environment variable validation', () => {
    it.each([
      ['POSTGRES_USER'],
      ['POSTGRES_PASSWORD'],
      ['POSTGRES_DB'],
      ['PROJECT_SCHEMA'],
    ])('should throw error when %s is missing', (variable) => {
      delete process.env[variable]

      expect(() => createDbClient({ schema: testSchema })).toThrow(
        `Missing required database environment variables: ${variable}`
      )
    })

    it('should throw error when multiple required variables are missing', () => {
      // Completely clear environment and set specific variables
      process.env.POSTGRES_USER = undefined
      process.env.POSTGRES_PASSWORD = undefined
      process.env.POSTGRES_DB = undefined

      expect(() => createDbClient({ schema: testSchema })).toThrow(
        'Missing required database environment variables: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB'
      )
    })
  })

  describe('Successful client creation', () => {
    beforeEach(() => {
      // Mock Pool constructor to avoid actual database connections
      vi.mock('pg', () => ({
        // biome-ignore lint/style/useNamingConvention: Matching the mock naming convention
        Pool: vi.fn().mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }))
    })

    it('should create client with all required environment variables', () => {
      const result = createDbClient({ schema: testSchema })

      expect(result).toHaveProperty('db')
      expect(result).toHaveProperty('pool')
    })

    it('should use default values for optional environment variables', () => {
      process.env.POSTGRES_HOST = undefined
      process.env.POSTGRES_PORT = undefined

      const result = createDbClient({ schema: testSchema })

      expect(result).toHaveProperty('db')
      expect(result).toHaveProperty('pool')
    })

    it('should merge custom pool configuration', () => {
      const customPoolConfig = {
        max: 10,
        idleTimeoutMillis: 15000,
      }

      const result = createDbClient({
        schema: testSchema,
        poolConfig: customPoolConfig,
      })

      expect(result).toHaveProperty('db')
      expect(result).toHaveProperty('pool')
    })
  })
})
