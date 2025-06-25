import type { Config } from 'drizzle-kit'

export interface DrizzleConfigOptions {
  /** Path to schema file relative to project root */
  schemaPath: string
  /** Output directory for migrations relative to project root */
  outDir?: string
  /** Optional tables filter for Drizzle Kit */
  tablesFilter?: string[]
}

/**
 * Creates a Drizzle configuration for PostgreSQL databases with schema-based project isolation.
 *
 * Environment variables are inherited from Moon's workspace configuration:
 * - Global DB config from root .env (POSTGRES_USER, POSTGRES_PASSWORD, etc.)
 * - Project-specific schema from PROJECT_SCHEMA env var
 *
 * @param options Configuration options for the Drizzle setup
 * @returns Drizzle Kit configuration object
 */
export function createDrizzleConfig(options: DrizzleConfigOptions): Config {
  const { schemaPath, outDir = './drizzle', tablesFilter } = options

  // Environment variables are automatically loaded by Moon's workspace config
  // No need to explicitly load .env files - Moon handles inheritance

  const {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DB,
    POSTGRES_PORT = '5432',
    POSTGRES_HOST = 'localhost',
    PROJECT_SCHEMA,
  } = process.env

  const missingEnvVars: string[] = []
  for (const envVar of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
    if (!process.env[envVar]) {
      missingEnvVars.push(envVar)
    }
  }

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missingEnvVars.join(
        ', '
      )}`
    )
  }

  // Validating separately for type checking
  if (!PROJECT_SCHEMA) {
    throw new Error('Missing required environment variable: PROJECT_SCHEMA')
  }

  // Build connection string with schema
  const connectionString = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=${PROJECT_SCHEMA}`

  const config: Config = {
    schema: schemaPath,
    out: outDir,
    dialect: 'postgresql',
    dbCredentials: {
      url: connectionString,
    },
    // Use schema-specific migration table
    schemaFilter: [PROJECT_SCHEMA],
  }

  // Add tables filter if provided
  if (tablesFilter && tablesFilter.length > 0) {
    config.tablesFilter = tablesFilter
  }

  return config
}
