#!/usr/bin/env node

/**
 * Script to initialize a PostgreSQL schema for a project in the RHDS monorepo.
 * Usage: 
 *   node scripts/init-project-schema.js <project-path>
 *   node scripts/init-project-schema.js apps/bank-api
 * 
 * The script will:
 * 1. Load PROJECT_SCHEMA from the project's .env file
 * 2. Create the schema if it doesn't exist
 * 3. Update the project registry
 */

import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  POSTGRES_PORT = '5432',
  POSTGRES_HOST = 'localhost',
} = process.env

if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
  console.error('❌ Missing required database environment variables')
  console.error('Required: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB')
  process.exit(1)
}

const [projectPath] = process.argv.slice(2)

if (!projectPath) {
  console.error('❌ Project path is required')
  console.error('Usage: node scripts/init-project-schema.js <project-path>')
  console.error('Example: node scripts/init-project-schema.js apps/bank-api')
  process.exit(1)
}

// Load project-specific environment variables
const projectEnvPath = path.resolve(__dirname, '..', projectPath, '.env')
if (existsSync(projectEnvPath)) {
  console.log(`📄 Loading project environment from: ${projectEnvPath}`)
  dotenv.config({ path: projectEnvPath })
} else {
  console.error(`❌ Project .env file not found: ${projectEnvPath}`)
  console.error('Please create a .env file in your project directory with PROJECT_SCHEMA defined')
  process.exit(1)
}

const { PROJECT_SCHEMA } = process.env

if (!PROJECT_SCHEMA) {
  console.error('❌ PROJECT_SCHEMA not found in project .env file')
  console.error('Please add PROJECT_SCHEMA=your_schema_name to your project .env file')
  process.exit(1)
}

const projectName = path.basename(projectPath)
const schemaName = PROJECT_SCHEMA

async function initializeProjectSchema() {
  const pool = new Pool({
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DB,
    host: POSTGRES_HOST,
    port: Number.parseInt(POSTGRES_PORT, 10),
  })

  try {
    console.log(`🔄 Initializing schema for project: ${projectName}`)
    console.log(`📊 Schema name: ${schemaName} (from PROJECT_SCHEMA)`)

    // Check if schema already exists
    const schemaExists = await pool.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
      [schemaName]
    )

    if (schemaExists.rows.length > 0) {
      console.log(`✅ Schema '${schemaName}' already exists`)
    } else {
      // Create schema
      await pool.query(`CREATE SCHEMA "${schemaName}"`)
      console.log(`✅ Created schema: ${schemaName}`)

      // Grant permissions
      await pool.query(
        `GRANT ALL PRIVILEGES ON SCHEMA "${schemaName}" TO "${POSTGRES_USER}"`
      )
      console.log(`✅ Granted permissions to user: ${POSTGRES_USER}`)
    }

    // Update project_schemas table
    await pool.query(
      `INSERT INTO public.project_schemas (project_name, schema_name) 
       VALUES ($1, $2) 
       ON CONFLICT (project_name) DO UPDATE SET 
         schema_name = EXCLUDED.schema_name,
         updated_at = CURRENT_TIMESTAMP`,
      [projectName, schemaName]
    )
    console.log('✅ Updated project registry')

    console.log('')
    console.log('🎉 Schema initialization complete!')
    console.log('')
    console.log(`✅ Using PROJECT_SCHEMA=${schemaName} from ${projectPath}/.env`)
    console.log('You can now run migrations in your project directory.')
    console.log('')
  } catch (error) {
    console.error('❌ Error initializing schema:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

initializeProjectSchema()
