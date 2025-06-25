import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import { Pool, type PoolConfig } from 'pg'

export interface DbClientOptions<TSchema extends Record<string, AnyPgTable>> {
  poolConfig?: PoolConfig
  schema: TSchema
}

/**
 * Creates a database client with automatic environment-based configuration and schema isolation.
 *
 * Environment variables are inherited from Moon's workspace configuration:
 * - Global DB config from root .env (POSTGRES_USER, POSTGRES_PASSWORD, etc.)
 * - Project-specific schema from PROJECT_SCHEMA env var
 *
 * @param options Configuration options for the database client
 * @returns Database client with connection pool
 */
export function createDbClient<TSchema extends Record<string, AnyPgTable>>(
  options: DbClientOptions<TSchema>
): { db: NodePgDatabase<TSchema>; pool: Pool } {
  const { schema, poolConfig } = options

  // Environment variables are automatically loaded by Moon's workspace config
  // No need to explicitly load .env files - Moon handles inheritance

  const {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DB,
    POSTGRES_PORT = '5432',
    POSTGRES_HOST = 'localhost',
  } = process.env

  const missingVariables: string[] = []
  for (const required of [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'PROJECT_SCHEMA',
  ]) {
    if (!process.env[required]) {
      missingVariables.push(required)
    }
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missingVariables.join(
        ', '
      )}`
    )
  }

  // Build connection configuration
  const defaultPoolConfig: PoolConfig = {
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DB,
    host: POSTGRES_HOST,
    port: Number.parseInt(POSTGRES_PORT, 10),
    // Set the search_path to use project schema first, then public
    options: `-c search_path=${process.env.PROJECT_SCHEMA},public`,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }

  // Merge with provided pool config
  const finalPoolConfig = { ...defaultPoolConfig, ...poolConfig }

  const pool = new Pool(finalPoolConfig)
  const db = drizzle(pool, { schema })

  return { db, pool }
}
