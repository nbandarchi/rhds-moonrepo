# Building Type-Safe APIs with the RHDS API Toolkit: Setup Guide

The RHDS API Toolkit provides a comprehensive set of tools for building type-safe, well-tested APIs with minimal boilerplate. This guide will get you up and running with a new API project in minutes.

Starting with an empty project directory? Follow these steps to create your first API:

### 1. Create Your Project in the Monorepo

```bash
# From the monorepo root (rhds-monorepo)
mkdir -p apps/user-service
cd apps/user-service

# Initialize Node.js project
npm init -y

# Install dependencies using Moon's managed versions
# Option 1: Manual install with pnpm (Moon will sync versions)
pnpm add fastify drizzle-orm drizzle-kit pg zod
pnpm add -D @types/node @types/pg tsx typescript vitest

# Option 2: Let Moon handle dependency management automatically
moon sync  # Adds @rhds/api via dependsOn and syncs workspace dependency versions
pnpm install
```

### 2. Set Up Moon Configuration

Create `moon.yml` in your project root:

```yaml
# moon.yml
# https://moonrepo.dev/docs/config/project
$schema: 'https://moonrepo.dev/schemas/project.json'

language: 'typescript'
type: 'application'

dependsOn:
  - 'api'  # Automatically adds @rhds/api to package.json dependencies

# All tasks now inherited from global .moon/tasks.yml
# Project automatically inherits: dev, build, test, test-watch, type-check, lint, format, etc.
# Environment files (.env) are automatically loaded from workspace root and project root
# Dependency versions are synced from workspace configuration when you run 'moon sync'
```

### 3. Sync Dependencies with Moon

Before creating configuration files, sync the project dependencies:

```bash
# From your project directory (apps/user-service)
# This will add @rhds/api to package.json and sync dependency versions
moon sync projects

# Install the synced dependencies
pnpm install
```

This command will:
- Add `@rhds/api: "workspace:*"` to your `package.json` (from `dependsOn: ['api']`)
- Sync common dependency versions from the workspace configuration
- Add common package.json scripts that work with Moon tasks
- Ensure `@rhds/api` is available for import in your Drizzle config

### 4. Create Essential Configuration Files

**TypeScript Configuration** (`tsconfig.json`):
```json
{
  "extends": "../../configs/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

This extends the shared base configuration from `configs/tsconfig.base.json` for consistency across the monorepo.

**Drizzle Configuration** (`drizzle.config.ts`):
```typescript
import { createDrizzleConfig } from '@rhds/api'

export default createDrizzleConfig({
  schemaPath: './src/routes/**/*.schema.ts',
})
```

Note: The `projectSchema` is automatically inferred from your environment variables.

**Package.json Scripts** (automatically added by `moon sync`):
```json
{
  "name": "user-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "test": "vitest run --exclude=\"**/*.integration.test.ts\"",
    "test:integration": "vitest run integration.test.ts",
    "test:watch": "vitest",
    "test:all": "vitest run",
    "test:coverage": "vitest run --coverage",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

These scripts are automatically added when you run `moon sync projects`.

### 5. Set Up Project Environment

First, copy the sample environment file:

```bash
# Copy the sample environment file to your project
cp ../../packages/api/.env.sample .env

# Edit the PROJECT_SCHEMA to match your project
# .env should contain:
# PROJECT_SCHEMA=user_service
```

### 6. Set Up Database Schema

Create your database schema (`src/routes/users/users.schema.ts`):

```typescript
import { json, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamps } from '@rhds/api'
import { z } from 'zod'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  authId: text('auth_id').notNull().unique(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  meta: json('meta').notNull(),
  ...timestamps(),
})

export type User = typeof users.$inferSelect
export type InsertUser = typeof users.$inferInsert
export type UpdateUser = Partial<
  Omit<User, 'id' | 'authId' | 'createdAt' | 'updatedAt'>
>
```

Note: This uses the `timestamps()` helper from `@rhds/api` which provides standardized `createdAt` and `updatedAt` columns.

**Schema Registry** (`src/db/schema.ts`):
```typescript
import { users } from '../routes/users/users.schema'

export const schema = {
  users,
}

export type Schema = typeof schema

// Re-export everything for drizzle-kit
export * from '../routes/users/users.schema'
```

**Database Client** (`src/db/client.ts`):
```typescript
import { createDbClient as createDbClientImpl } from '@rhds/api'
import { schema } from './schema'

export const createDbClient = () => {
  return createDbClientImpl({ schema })
}

export type { Schema } from './schema'
```

### 7. Create Your Repository

Create a user repository (`src/routes/users/users.repository.ts`):

```typescript
import { BaseRepository } from '@rhds/api'
import type { Schema } from '../../db/schema'
import { users } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export class UserRepository extends BaseRepository<typeof users, Schema> {
  constructor(db: NodePgDatabase<Schema>) {
    super(db, users)
  }
}
```

### 8. Create Fastify App Factory

Create the Fastify app creation function (`src/server.ts`):

```typescript
import Fastify from 'fastify'
import { UserRepository } from './routes/users/users.repository'
import { createDbClient } from './db/client'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from './db/schema'

type Repositories = {
  users: UserRepository
}

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>
    repositories: Repositories
  }
}

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // Create database client and attach to app
  const { db } = createDbClient()
  fastify.decorate('db', db)

  // Create repositories and attach to app
  fastify.decorate('repositories', {
    users: new UserRepository(db),
  })

  // Error handling
  fastify.setErrorHandler((error, _, reply) => {
    const statusCode = error.statusCode || 500

    reply.status(statusCode).send({
      error: true,
      message: error.message,
      statusCode,
    })
  })

  // Routes will be added later

  return fastify
}
```

### 9. Create Test Fixture

Create a user fixture (`src/routes/users/users.fixture.ts`):

```typescript
import { BaseFixture } from '@rhds/api'
import type { Schema } from '../../db/schema'
import { users } from '../../db/schema'
import type { User } from '../../routes/users/users.schema'

export class UserFixture extends BaseFixture<typeof users, Schema> {
  public schema = users

  static ids = {
    testUser: '123e4567-e89b-12d3-a456-426614174001',
  }

  data: Record<string, User> = {
    testUser: {
      id: UserFixture.ids.testUser,
      authId: 'auth0|1234567890',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      meta: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
  }

  public responses = {
    entities: {
      testUser: {
        ...this.data.testUser,
        createdAt: this.data.testUser.createdAt.toISOString(),
        updatedAt: this.data.testUser.updatedAt.toISOString(),
      },
    },
  }
}
```

Note: The `static ids` pattern provides easy access to test IDs across your test suite.

### 10. Create Fixture Registry

Create a centralized fixture registry (`src/testing/fixtures.ts`):

```typescript
import { UserFixture } from '../routes/users/users.fixture'
import { FixtureLoader } from '@rhds/api'

export const fixtures = new FixtureLoader()
fixtures.addFixture(new UserFixture())
```

### 11. Create Integration Test

Create an integration test (`src/routes/users/__tests__/users.integration.test.ts`):

```typescript
import { beforeAll, beforeEach, describe, expect, it, afterAll } from 'vitest'
import { createApp } from '../../../server'
import type { FastifyInstance } from 'fastify'
import { UserFixture } from '../users.fixture'
import { fixtures } from '../../../testing/fixtures'

describe('Users Integration Tests', () => {
  let app: FastifyInstance
  const userFixture = fixtures.getFixture(UserFixture)
  const { testUser } = userFixture.data

  beforeAll(async () => {
    app = await createApp()
  })

  beforeEach(async () => {
    await fixtures.reloadAll(app.db)
  })

  afterAll(async () => {
    await fixtures.clearAll(app.db)
    await app.close()
  })

  describe('User Repository Tests', () => {
    it('should get a user by id', async () => {
      const userRepository = app.repositories.users
      const user = await userRepository.getById(testUser.id)
      expect(user).toEqual(testUser)
    })
  })

  // Add route tests after implementing the routes in later steps
})
```

Note: This uses `fixtures.reloadAll()` instead of separate `loadAll()` and `clearAll()` calls for better test performance.

### 12. Initialize Database and Test (Checkpoint)

Now let's set up the database and run our first test to make sure everything is working:

```bash
# Start the database (run from project directory or monorepo root)
moon run db-start

# Initialize your project schema (run from project directory - uses PROJECT_SCHEMA from .env)
moon run db-init-schema

# Generate and run migrations
moon run db-generate
moon run db-migrate

# Run the integration test to verify everything works
moon run test-integration
```

If the test passes, you've successfully set up the basic CRUD functionality! 🎉

**Note**: You can also use `pnpm` scripts directly (e.g., `pnpm db:generate`), but Moon tasks provide environment inheritance and better dependency management.

### 13. Create API Validation Schemas

Now that the core database functionality is working, let's add API validation schemas. Add these to your `src/routes/users/users.schema.ts` file:

```typescript
// Add to the existing users.schema.ts file:
import { z } from 'zod'

// Request validation schemas
export const CreateUserRequest = z.object({
  authId: z.string().min(1, 'Auth ID is required'),
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  meta: z.record(z.any()).default({}),
})

export const UpdateUserRequest = CreateUserRequest.partial().omit({
  authId: true, // Don't allow changing auth ID
  email: true, // Don't allow changing email
})

// Response validation schema
export const UserResponse = z.object({
  id: z.string().uuid(),
  authId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  meta: z.record(z.any()),
  createdAt: z.string(), // ISO string for API responses
  updatedAt: z.string(), // ISO string for API responses
})

export type UserReßsponse = z.infer<typeof UserResponse>
export type CreateUserRequest = z.infer<typeof CreateUserRequest>
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>
```

**Note**: These are separate from the database types - they define the API contract for validation and serialization. Later, we'll explore using `drizzle-zod` to automatically generate these from the database schema.

### 14. Create Routes

Set up your routes (`src/routes/users/users.routes.ts`):

```typescript
import type { FastifyInstance } from 'fastify'
import { createRouteRegistry, SchemaBuilder, NotFoundError } from '@rhds/api'
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from './users.schema'

export function registerUserRoutes(fastify: FastifyInstance) {
  const routes = createRouteRegistry(fastify, '/api/users')
  // Use repositories attached to the app instance

  // GET /api/users/:id
  routes.get('/:id', SchemaBuilder.getById(UserResponse), async ({ params }, reply) => {
    const user = await fastify.repositories.users.getById(params.id)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  })

  // GET /api/users
  routes.get('/', SchemaBuilder.getAll(UserResponse), async () => {
    const users = await fastify.repositories.users.getAll()
    return users.map(user => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }))
  })

  // POST /api/users
  routes.post('/', SchemaBuilder.post(CreateUserRequest, UserResponse), async ({ body }) => {
    const user = await fastify.repositories.users.create(body)
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  })

  // PUT /api/users/:id
  routes.put('/:id', SchemaBuilder.update(UpdateUserRequest, UserResponse), async ({ params, body }) => {
    const user = await fastify.repositories.users.update(params.id, body)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  })

  // DELETE /api/users/:id
  routes.delete('/:id', SchemaBuilder.delete(), async ({ params }) => {
    const result = await fastify.repositories.users.delete(params.id)
    if (!result.deleted) {
      throw new NotFoundError('User not found')
    }
    return result
  })
}
```

### 15. Create Initial Route Integration Test

Now let's create an initial integration test to verify our routes work correctly. Update your existing integration test (`src/routes/users/__tests__/users.integration.test.ts`) to include route testing:

```typescript
import { beforeAll, beforeEach, describe, expect, it, afterAll } from 'vitest'
import { createApp } from '../../../server'
import type { FastifyInstance } from 'fastify'
import { UserFixture } from '../users.fixture'
import { fixtures } from '../../../testing/fixtures'

describe('Users Integration Tests', () => {
  let app: FastifyInstance
  const userFixture = fixtures.getFixture(UserFixture)
  const { testUser } = userFixture.data
  const { responses } = userFixture

  beforeAll(async () => {
    app = await createApp()
  })

  beforeEach(async () => {
    await fixtures.reloadAll(app.db)
  })

  afterAll(async () => {
    await fixtures.clearAll(app.db)
    await app.close()
  })

  describe('User Repository Tests', () => {
    it('should get a user by id', async () => {
      const userRepository = app.repositories.users
      const user = await userRepository.getById(testUser.id)
      expect(user).toEqual(testUser)
    })
  })

  describe('User Routes Tests', () => {
    it('should get a user by id via API', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/users/${testUser.id}`,
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result).toEqual(responses.entities.testUser)
    })
})
```

Run the test to verify everything works:

```bash
# Run the integration test to verify routes work
moon run test-integration
```

### 16. Update Server with Routes

Update your `src/server.ts` to register the routes:

```typescript
import Fastify from 'fastify'
import { UserRepository } from './routes/users/users.repository'
import { createDbClient } from './db/client'
import { registerUserRoutes } from './routes/users/users.routes'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { schema } from './db/schema'

type Repositories = {
  users: UserRepository
}

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>
    repositories: Repositories
  }
}

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // Create database client and attach to app
  const { db } = createDbClient()
  fastify.decorate('db', db)
  
  // Create repositories and attach to app
  fastify.decorate('repositories', {
    users: new UserRepository(db),
  })

  // Error handling
  fastify.setErrorHandler((error, _, reply) => {
    const statusCode = error.statusCode || 500

    reply.status(statusCode).send({
      error: true,
      message: error.message,
      statusCode,
    })
  })

  // Register routes
  registerUserRoutes(fastify)
  
  return fastify
}
```

### 17. Create Server Entry Point

Create the server entry point (`src/index.ts`):

```typescript
import { createApp } from './server'

async function start() {
  try {
    const app = await createApp()

    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0',
    })

    console.log('🚀 User API Server started on port 3000')
  } catch (error) {
    console.error('❌ Error starting server:', error)
    process.exit(1)
  }
}

start()
```

### 18. Sync Dependencies

Moon automatically manages dependencies and their versions across the monorepo:

```bash
# From your project directory
# Run this to sync dependencies based on dependsOn in moon.yml
moon sync

# This command will:
# 1. Add @rhds/api to package.json (from dependsOn: ['api'])
# 2. Sync common dependency versions from workspace configuration
# 3. Ensure version consistency across projects

# Check that @rhds/api was added to package.json
cat package.json | grep "@rhds/api"
# Should show: "@rhds/api": "workspace:*"

# Install the synced dependencies
pnpm install
```

**How it works:**
- The workspace configuration in `.moon/workspace.yml` defines shared dependency versions
- Moon's `syncProjectWorkspaceDependencies: true` setting ensures version consistency
- The `dependsOn: ['api']` in your `moon.yml` automatically adds `@rhds/api` as a dependency
- Running `moon sync` applies all these configurations to your `package.json`

### 19. Add OpenAPI Documentation

Install Swagger dependencies and update your server to include API documentation:

```bash
# Add Swagger dependencies
pnpm add @fastify/swagger @fastify/swagger-ui
```

Update `src/server.ts` to include Swagger:

```typescript
import FastifySwagger from '@fastify/swagger'
import FastifySwaggerUi from '@fastify/swagger-ui'

...
export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  await fastify.register(FastifySwagger, {
    openapi: {
      info: {
        title: 'User Service API',
        version: '1.0.0',
      },
    },
  })

  await fastify.register(FastifySwaggerUi, {
    baseDir: '/api',
    routePrefix: '/docs',
  })
  ...
}
```

Add a script to `package.json`:

```json
{
  "scripts": {
    "docs:generate": "tsx src/testing/setup.ts",
    "docs:serve": "pnpm docs:generate && pnpm dev"
  }
}
```

### 20. Set Up OpenAPI Traffic Auditor

The OpenAPI auditor automatically captures API traffic during integration tests and generates comprehensive coverage reports. This ensures your OpenAPI documentation stays in sync with your actual API behavior.

Since the auditor has difficulty writing to files from the consuming API we need to create a file operations object that uses Node.js sync APIs to let it read and write the test files.

First, create the auditor configuration (`src/testing/auditor.ts`):

```typescript
import { OpenApiAuditor, type FileOperations } from '@rhds/api'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createApp } from '../server'

// File operations using Node.js sync APIs to avoid async/await issues in vitest
const fileOps: FileOperations = {
  readFile: (path: string) => readFileSync(path, 'utf8'),
  writeFile: (path: string, content: string) => writeFileSync(path, content, 'utf8'),
  mkdir: (path: string, options?: { recursive?: boolean }) => {
    mkdirSync(path, options)
  },
  glob: (pattern: string) => {
    // Enhanced glob implementation for various file patterns
    const lastSlash = pattern.lastIndexOf('/')
    const dir = lastSlash > 0 ? pattern.substring(0, lastSlash) : '.'
    const filePattern = pattern.substring(lastSlash + 1)
    
    try {
      const files = readdirSync(dir)
      
      if (filePattern === '*.json') {
        return files.filter(file => file.endsWith('.json')).map(file => join(dir, file))
      } else if (filePattern === '*.md') {
        return files.filter(file => file.endsWith('.md')).map(file => join(dir, file))
      } else {
        // For more complex patterns, just return files that match the extension
        const ext = filePattern.replace('*', '')
        return files.filter(file => file.endsWith(ext)).map(file => join(dir, file))
      }
    } catch {
      return []
    }
  },
  removeFile: (path: string) => {
    try {
      unlinkSync(path)
    } catch {
      // Ignore errors - file might not exist
    }
  }
}

// Create the auditor instance
export const auditor = new OpenApiAuditor({
  schemaPath: './generated/openapi-schema.json',
  trafficDir: './generated/traffic',
  reportPath: './generated/audit-report.md',
  fileOps
})

// Export the setup function for vitest globalSetup
export default async function setup() {
  return auditor.setup(createApp)
}
```

Then, update your `vitest.config.ts` to use the auditor as a global setup:

```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../configs/vitest.config.base'

export default defineConfig(
  mergeConfig(baseConfig, {
    test: {
      globalSetup: './src/testing/auditor.ts',
    },
  })
)
```

### 22. Add Traffic Recording to Integration Tests

Update your integration test to record API traffic (`src/routes/users/__tests__/users.integration.test.ts`):

```typescript
...
import { auditor } from '../../../testing/auditor'

describe('Users Integration Tests', () => {
  let app: FastifyInstance
  const userFixture = fixtures.getFixture(UserFixture)
  const { testUser } = userFixture.data
  const { responses } = userFixture

  beforeAll(async () => {
    app = await createApp()
    // Register the auditor plugin for traffic capture
    auditor.registerPlugin(app)
  })

  beforeEach(async () => {
    await fixtures.loadAll(app.db)
  })

  afterEach(async () => {
    await fixtures.clearAll(app.db)
  })

  afterAll(async () => {
    // Write captured traffic to named file for auditing
    await auditor.writeTraffic('users-integration')
    await app.close()
  })
...
})
```

### 23. Expanding Fixtures and Integration Tests for 100% Coverage

To achieve complete test coverage, you'll need to expand your fixtures and integration tests to cover all scenarios including edge cases, validation errors, and various HTTP status codes.

#### Enhanced User Fixture

First, expand your `UserFixture` to include more test data and validation scenarios:

```typescript
// src/routes/users/users.fixture.ts
import { BaseFixture } from '@rhds/api'
import type { Schema } from '../../db/schema'
import { users } from '../../db/schema'
import type { User } from '../../routes/users/users.schema'
import { expect } from 'vitest'

export class UserFixture extends BaseFixture<typeof users, Schema> {
  public schema = users

  static ids = {
    testUser: '123e4567-e89b-12d3-a456-426614174001',
  }

  data: Record<string, User> = {
    testUser: {
      id: UserFixture.ids.testUser,
      authId: 'auth0|1234567890',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      meta: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
  }

  public requests = {
    create: {
      valid: {
        authId: 'auth0|9876543210',
        email: 'test2@example.com',
        firstName: 'Test',
        lastName: 'User',
        meta: { test: 'test' },
      },
    },
    update: {
      nameOnly: {
        firstName: 'Test',
        lastName: 'User',
      },
      fullUpdate: {
        firstName: 'Test',
        lastName: 'User',
        meta: { test: 'test' },
      },
    },
    invalid: {
      missingRequired: {
        authId: '',
        email: '',
        firstName: '',
        lastName: '',
      },
    },
  }

  public responses = {
    entities: {
      testUser: {
        ...this.data.testUser,
        createdAt: this.data.testUser.createdAt.toISOString(),
        updatedAt: this.data.testUser.updatedAt.toISOString(),
      },
    },
    created: {
      fromValidRequest: {
        ...this.requests.create.valid,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    },
    updated: {
      nameOnlyUpdate: {
        ...this.data.testUser,
        firstName: this.requests.update.nameOnly.firstName,
        lastName: this.requests.update.nameOnly.lastName,
        createdAt: this.data.testUser.createdAt.toISOString(),
        updatedAt: expect.any(String),
      },
      fullUpdate: {
        ...this.data.testUser,
        firstName: this.requests.update.fullUpdate.firstName,
        lastName: this.requests.update.fullUpdate.lastName,
        meta: this.requests.update.fullUpdate.meta,
        createdAt: this.data.testUser.createdAt.toISOString(),
        updatedAt: expect.any(String),
      },
    },
    errors: {
      notFound: {
        message: 'User not found',
      },
      validationError: {
        message: 'Validation error',
      },
      invalidUuid: {
        message: 'Invalid UUID',
      },
    },
  }
}
```

#### Comprehensive Integration Tests

Now expand your integration tests to cover all endpoints and scenarios:

```typescript
// src/routes/users/__tests__/users.integration.test.ts
import { beforeAll, beforeEach, describe, expect, it, afterAll } from 'vitest'
import { createApp } from '../../../server'
import type { FastifyInstance } from 'fastify'
import { UserFixture } from '../users.fixture'
import { fixtures } from '../../../testing/fixtures'
import { auditor } from '../../../testing/auditor'

describe('Users Integration Tests', () => {
  let app: FastifyInstance
  const userFixture = fixtures.getFixture(UserFixture)
  const { testUser } = userFixture.data

  beforeAll(async () => {
    app = await createApp()
    auditor.registerPlugin(app)
  })

  beforeEach(async () => {
    await fixtures.reloadAll(app.db)
  })

  afterAll(async () => {
    await auditor.writeTraffic('user-service-integration')
    await fixtures.clearAll(app.db)
    await app.close()
  })

  describe('User Repository Tests', () => {
    it('should get a user by id', async () => {
      const userRepository = app.repositories.users
      const user = await userRepository.getById(testUser.id)
      expect(user).toEqual(testUser)
    })
  })

  describe('User Routes Tests', () => {
    describe('GET /users/:id', () => {
      it('should get a user by id', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/users/${testUser.id}`,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(userFixture.responses.entities.testUser)
      })

      it('should return 400 if an invalid UUID is provided', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/users/invalid-uuid',
        })
        expect(response.statusCode).toBe(400)
      })

      it('should return 404 if user not found', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/users/99999999-9999-9999-9999-999999999999',
        })
        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual(userFixture.responses.errors.notFound)
      })
    })

    describe('GET /users', () => {
      it('should get all users', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/users',
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual([
          userFixture.responses.entities.testUser,
        ])
      })
    })

    describe('POST /users', () => {
      it('should create a new user', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/users',
          payload: userFixture.requests.create.valid,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(
          userFixture.responses.created.fromValidRequest
        )
      })

      it('should return 400 for invalid request body', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/users',
          payload: userFixture.requests.invalid.missingRequired,
        })
        expect(response.statusCode).toBe(400)
      })
    })

    describe('PUT /users/:id', () => {
      it('should update a user', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/api/users/${testUser.id}`,
          payload: userFixture.requests.update.fullUpdate,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(
          userFixture.responses.updated.fullUpdate
        )
      })

      it('should partially update a user', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/api/users/${testUser.id}`,
          payload: userFixture.requests.update.nameOnly,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(
          userFixture.responses.updated.nameOnlyUpdate
        )
      })

      it('should return a 400 for an invalid request body', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/api/users/${testUser.id}`,
          payload: userFixture.requests.invalid.missingRequired,
        })
        expect(response.statusCode).toBe(400)
      })

      it('should return 404 if user not found', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/users/99999999-9999-9999-9999-999999999999',
          payload: userFixture.requests.update.nameOnly,
        })
        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual(userFixture.responses.errors.notFound)
      })
    })

    describe('DELETE /users/:id', () => {
      it('should delete a user', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: `/api/users/${testUser.id}`,
        })
        expect(response.statusCode).toBe(200)
      })

      it('should return 400 if an invalid UUID is provided', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/users/invalid-uuid',
        })
        expect(response.statusCode).toBe(400)
      })

      it('should return 404 if user not found', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/users/99999999-9999-9999-9999-999999999999',
        })
        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual(userFixture.responses.errors.notFound)
      })
    })
  })
})
```

#### Additional Server Error Handling Test

To achieve 100% coverage including the generic error handler, create a separate server test (`src/__tests__/server.test.ts`):

```typescript
import { describe, beforeAll, afterAll, it, expect } from 'vitest'
import { createApp } from '../server'
import type { FastifyInstance } from 'fastify'

describe('Server Tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createApp()
    app.get('/generic-error', async () => {
      throw new Error('Generic Error')
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('should handle unexpected errors gracefully', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/generic-error',
    })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: true,
      message: 'Generic Error',
      statusCode: 500,
    })
  })
})
```

This server test handles the missing branch in your generic error handler by:
- Creating a test route that throws a generic `Error` (not a Fastify HTTP error)
- Testing that the error handler properly converts it to a 500 response
- Ensuring the error response format matches expectations

This comprehensive test suite ensures:
- ✅ All CRUD operations are tested (GET, POST, PUT, DELETE)
- ✅ Success scenarios (200) are covered
- ✅ Validation errors (400) are covered  
- ✅ Not found errors (404) are covered
- ✅ Server errors (500) are covered via the separate server test
- ✅ Both full and partial update scenarios are tested
- ✅ Repository layer is tested separately from routes
- ✅ Generic error handling branch is covered

Run the tests to verify 100% coverage:

```bash
# Run all tests with coverage
moon run test-coverage

# Should show 100% coverage across all files
```

### 24. Understanding the Generated Audit Report

When you run your integration tests, the auditor automatically generates a comprehensive audit report showing:

#### **Coverage Summary**
- **Paths Tested**: How many API endpoints were actually called
- **Method/Status Combinations Tested**: Detailed coverage of each HTTP method and status code  
- **Total Requests**: Number of HTTP requests captured
- **Undocumented Endpoints Found**: Endpoints in traffic but not in OpenAPI spec

#### **🚨 Undocumented Endpoints** 
Shows endpoints found in your traffic that aren't documented in your OpenAPI specification:
```markdown
### `GET /demo`
- Status codes: 200
```
*This typically indicates test endpoints or missing API documentation.*

#### **✅ Tested Endpoints**
Shows successfully tested endpoints with their status codes:
```markdown
### `/api/accounts/{id}`
- **GET**: 200
```

#### **❌ Missing Coverage**
Broken down into two categories:

**Completely Untested Endpoints**: Documented in OpenAPI but no traffic captured
```markdown
### `/api/users`
- **GET**: 200
- **POST**: 200, 400
```

**Missing Status Code Coverage**: Endpoints tested but missing some status codes
```markdown
### `/api/users/{id}`
- **GET**: Missing 404
- **PUT**: Missing 200, 400, 404  
- **DELETE**: Missing 200, 400, 404
```

### 24. Running the Complete Audit Workflow

Test your complete setup:

```bash
# Run integration tests with auditing enabled
moon run test-integration

# Check generated files
ls generated/
# openapi-schema.json   - Auto-generated from your routes
# traffic/              - Directory containing traffic files
# audit-report.md       - Comprehensive coverage report

# View the audit report
cat generated/audit-report.md
```

The console output will show:
```
🧹 Clearing 3 files from generated directories
✅ OpenAPI schema generated at: ./generated/openapi-schema.json
📊 Traffic written: ./generated/traffic/users-integration.json (2 requests)
✅ OpenAPI audit report generated: ./generated/audit-report.md
```

### 25. Adding More Test Coverage

Based on your audit report, add missing test cases. For example, to test 404 responses:

```typescript
// Add to your integration test
it('should return 404 for non-existent user', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/users/123e4567-e89b-12d3-a456-426614174999',
  })

  expect(response.statusCode).toBe(404)
  expect(response.json()).toEqual({
    error: true,
    message: 'User not found',
    statusCode: 404,
  })
})

it('should return 400 for invalid UUID format', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/users/invalid-uuid',
  })

  expect(response.statusCode).toBe(400)
})
```

**🎉 Complete OpenAPI Auditing Setup Achieved!**

Your API now features:
- ✅ **Automatic directory cleanup** on each test run  
- ✅ **Traffic capture** during integration tests
- ✅ **OpenAPI schema generation** from route definitions
- ✅ **Comprehensive audit reports** with status code breakdowns
- ✅ **Undocumented endpoint detection** for test endpoints
- ✅ **Missing coverage analysis** to guide test development

**🎉 That's it! You now have a fully functional type-safe API with:**
- ✅ Project environment setup with PROJECT_SCHEMA
- ✅ Database schema with validation (co-located with routes using glob patterns)
- ✅ Type-safe CRUD operations via BaseRepository
- ✅ Test fixtures and integration tests for reliability
- ✅ Database initialization using environment variables
- ✅ Automatic request/response validation with Zod
- ✅ Error handling with proper HTTP status codes
- ✅ Development server with hot reload
- ✅ Moon task inheritance for simplified configuration
- ✅ **OpenAPI documentation with Swagger UI**
- ✅ **Automatic traffic recording during integration tests**
- ✅ **Comprehensive API coverage auditing with status code breakdowns**
- ✅ **Undocumented endpoint detection and reporting**
- ✅ **Clean test state with automatic directory cleanup**
- ✅ **Test-driven API documentation that stays in sync**

**Step 11 serves as a checkpoint** - if your integration test passes, you know the core database and service functionality is working correctly before adding the API layer.

**Key Architecture Benefits:**
- **Co-located Schemas**: Database schemas live alongside routes using `./src/routes/**/*.schema.ts` glob pattern
- **Simplified Imports**: Schema types are exported from the database client for easy access
- **Dependency Injection**: Database and repositories are attached to the Fastify app instance using decorators
- **Clean Testing**: Integration tests use the same app instance for both service and route testing
- **Centralized Fixtures**: All test fixtures are registered in one place and can be easily accessed across tests
- **Database Injection**: Fixtures receive the database instance when loading/clearing, making setup cleaner
- **Separation of Concerns**: App creation (`server.ts`) is separate from server startup (`index.ts`)
- **Documentation-First**: OpenAPI schema auto-generated from route definitions with Zod validation
- **Traffic Auditing**: Real API traffic compared against OpenAPI specification for coverage validation
- **Complete Test Coverage**: Tests cover happy path, validation errors, and not found scenarios

---

## Complete Guide

For more advanced features like testing, AI integration, and OpenAPI documentation, continue with the sections below.

## Table of Contents

1. [Quick Start](#quick-start-5-minutes-to-first-api) ⬆️
2. [Database Schema with Drizzle](#database-schema-with-drizzle)
3. [Creating Repositories](#creating-repositories)
4. [Validation Schemas](#validation-schemas)
5. [Route Registry and Schema Builder](#route-registry-and-schema-builder)
6. [Testing with Fixtures](#testing-with-fixtures)
7. [OpenAI Client Integration](#openai-client-integration)
8. [Putting It All Together](#putting-it-all-together)

## Database Schema with Drizzle

Let's create a complete example by building a task management API. Start by defining your database schema:

### 1. Create the Schema File

```typescript
// src/db/schema/tasks.ts
import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// Define enums
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'completed', 'cancelled'])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent'])

// Define the table
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('todo').notNull(),
  priority: taskPriorityEnum('priority').default('medium').notNull(),
  assigneeEmail: text('assignee_email'),
  dueDate: timestamp('due_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Generate Zod schemas from Drizzle schema
export const InsertTaskSchema = createInsertSchema(tasks, {
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  assigneeEmail: z.string().email('Invalid email format').optional(),
  dueDate: z.date().optional(),
})

export const SelectTaskSchema = createSelectSchema(tasks)
export const UpdateTaskSchema = InsertTaskSchema.partial().omit({ id: true, createdAt: true })

// Export types
export type Task = typeof tasks.$inferSelect
export type InsertTask = typeof tasks.$inferInsert
export type UpdateTask = z.infer<typeof UpdateTaskSchema>
```

### 2. Update Database Configuration

```typescript
// src/db/schema/index.ts
export * from './tasks'

// src/db/client.ts - Update your schema imports
import { createDbClient } from '@rhds/api'
import * as schema from './schema'

export const { db, pool } = createDbClient({ schema })
export { schema }
```

### 3. Create and Run Migrations

```bash
# Generate migration
moon run db-generate

# Run migration
moon run db-migrate
```

## Creating Repositories

The BaseRepository class provides type-safe CRUD operations. Create a service for your tasks:

```typescript
// src/repositories/task.service.ts
import { BaseRepository } from '@rhds/api'
import { db } from '../db/client'
import { tasks, type Task, type InsertTask, type UpdateTask } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export class TaskRepository extends BaseRepository<typeof tasks> {
  constructor() {
    super(db, tasks)
  }

  // Custom methods beyond basic CRUD
  async getByStatus(status: 'todo' | 'in_progress' | 'completed' | 'cancelled'): Promise<Task[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.status, status))
      .orderBy(desc(this.table.createdAt))
  }

  async getByAssignee(email: string): Promise<Task[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(this.table.assigneeEmail, email),
        eq(this.table.isActive, true)
      ))
      .orderBy(desc(this.table.createdAt))
  }

  async markCompleted(id: string): Promise<Task | null> {
    const updated = await this.db
      .update(this.table)
      .set({ 
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(this.table.id, id))
      .returning()

    return updated[0] || null
  }

  // Override soft delete behavior
  async delete(id: string): Promise<{ id: string; deleted: boolean }> {
    const updated = await this.db
      .update(this.table)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(this.table.id, id))
      .returning()

    return {
      id,
      deleted: updated.length > 0
    }
  }
}
```

## Validation Schemas

Create comprehensive validation schemas for your API endpoints:

```typescript
// src/schemas/task.schemas.ts
import { z } from 'zod'
import { InsertTaskSchema, UpdateTaskSchema, SelectTaskSchema } from '../db/schema'

// API Request Schemas
export const CreateTaskRequest = InsertTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const UpdateTaskRequest = UpdateTaskSchema

export const TaskQueryParams = z.object({
  status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).optional(),
  assignee: z.string().email().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// API Response Schemas  
export const TaskResponse = SelectTaskSchema.extend({
  // Transform dates to ISO strings for JSON serialization
  createdAt: z.string().or(z.date()).transform(val => 
    val instanceof Date ? val.toISOString() : val
  ),
  updatedAt: z.string().or(z.date()).transform(val => 
    val instanceof Date ? val.toISOString() : val
  ),
  dueDate: z.string().or(z.date()).nullable().transform(val => 
    val instanceof Date ? val.toISOString() : val
  ),
})

export const TaskListResponse = z.object({
  tasks: z.array(TaskResponse),
  total: z.number(),
  hasMore: z.boolean(),
})

// Export types
export type CreateTaskRequest = z.infer<typeof CreateTaskRequest>
export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequest>
export type TaskQueryParams = z.infer<typeof TaskQueryParams>
export type TaskResponse = z.infer<typeof TaskResponse>
export type TaskListResponse = z.infer<typeof TaskListResponse>
```

## Route Registry and Schema Builder

Use the route registry and schema builder to create type-safe endpoints:

```typescript
// src/routes/task.routes.ts
import { FastifyInstance } from 'fastify'
import { createRouteRegistry, SchemaBuilder } from '@rhds/api'
import { TaskRepository } from '../repositories/task.service'
import {
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskQueryParams,
  TaskResponse,
  TaskListResponse,
} from '../schemas/task.schemas'

export function registerTaskRoutes(fastify: FastifyInstance) {
  const routes = createRouteRegistry(fastify)
  const taskRepository = new TaskRepository()

  // GET /tasks - List tasks with filtering
  routes.get(
    '/tasks',
    {
      schema: {
        querystring: TaskQueryParams,
        response: {
          200: TaskListResponse,
        },
      },
    },
    async ({ query }) => {
      const { status, assignee, priority, limit, offset } = query
      
      let tasks
      let total = 0

      if (status) {
        tasks = await taskRepository.getByStatus(status)
      } else if (assignee) {
        tasks = await taskRepository.getByAssignee(assignee)
      } else {
        tasks = await taskRepository.getAll()
      }

      // Apply filtering and pagination
      const filteredTasks = tasks
        .filter(task => !priority || task.priority === priority)
        .slice(offset, offset + limit)

      total = tasks.length
      const hasMore = offset + limit < total

      return {
        tasks: filteredTasks.map(task => ({
          ...task,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          dueDate: task.dueDate?.toISOString() || null,
        })),
        total,
        hasMore,
      }
    }
  )

  // GET /tasks/:id - Get single task
  routes.get(
    '/tasks/:id',
    SchemaBuilder.getById(TaskResponse),
    async ({ params, repositories }) => {
      const task = await taskRepository.getById(params.id)
      if (!task) {
        throw new Error('Task not found')
      }

      return {
        ...task,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        dueDate: task.dueDate?.toISOString() || null,
      }
    }
  )

  // POST /tasks - Create task
  routes.post(
    '/tasks',
    SchemaBuilder.post(CreateTaskRequest, TaskResponse),
    async ({ body }) => {
      const task = await taskRepository.create({
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      })

      return {
        ...task,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        dueDate: task.dueDate?.toISOString() || null,
      }
    }
  )

  // PUT /tasks/:id - Update task
  routes.put(
    '/tasks/:id',
    SchemaBuilder.update(UpdateTaskRequest, TaskResponse),
    async ({ params, body }) => {
      const task = await taskRepository.update(params.id, {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      })

      if (!task) {
        throw new Error('Task not found')
      }

      return {
        ...task,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        dueDate: task.dueDate?.toISOString() || null,
      }
    }
  )

  // DELETE /tasks/:id - Delete task
  routes.delete(
    '/tasks/:id',
    SchemaBuilder.delete(),
    async ({ params }) => {
      return await taskRepository.delete(params.id)
    }
  )

  // POST /tasks/:id/complete - Mark task as completed
  routes.post(
    '/tasks/:id/complete',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: TaskResponse,
        },
      },
    },
    async ({ params }) => {
      const task = await taskRepository.markCompleted(params.id)
      if (!task) {
        throw new Error('Task not found')
      }

      return {
        ...task,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        dueDate: task.dueDate?.toISOString() || null,
      }
    }
  )
}
```

## Testing with Fixtures

Create comprehensive fixtures for testing your API:

```typescript
// src/fixtures/task.fixture.ts
import { BaseFixture } from '@rhds/api'
import { tasks, type Task } from '../db/schema'
import { expect } from 'vitest'

export class TaskFixture extends BaseFixture<
  typeof tasks,
  { tasks: typeof tasks }
> {
  public schema = tasks

  public data: Record<string, Task> = {
    todoTask: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Write project documentation',
      description: 'Create comprehensive docs for the new API',
      status: 'todo',
      priority: 'high',
      assigneeEmail: 'john@example.com',
      dueDate: new Date('2024-12-31'),
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
    inProgressTask: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Implement user authentication',
      description: 'Add JWT-based auth system',
      status: 'in_progress',
      priority: 'urgent',
      assigneeEmail: 'jane@example.com',
      dueDate: new Date('2024-11-15'),
      isActive: true,
      createdAt: new Date('2024-01-02T00:00:00Z'),
      updatedAt: new Date('2024-01-10T00:00:00Z'),
    },
    completedTask: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      title: 'Setup CI/CD pipeline',
      description: null,
      status: 'completed',
      priority: 'medium',
      assigneeEmail: 'bob@example.com',
      dueDate: null,
      isActive: true,
      createdAt: new Date('2024-01-03T00:00:00Z'),
      updatedAt: new Date('2024-01-15T00:00:00Z'),
    },
  }

  // API request fixtures
  public requests = {
    create: {
      valid: {
        title: 'New task',
        description: 'Task description',
        priority: 'medium' as const,
        assigneeEmail: 'test@example.com',
        dueDate: '2024-12-01T00:00:00Z',
      },
      minimal: {
        title: 'Minimal task',
      },
      withoutDueDate: {
        title: 'Task without due date',
        description: 'No deadline specified',
        priority: 'low' as const,
      },
    },
    update: {
      statusChange: {
        status: 'in_progress' as const,
      },
      fullUpdate: {
        title: 'Updated task title',
        description: 'Updated description',
        status: 'completed' as const,
        priority: 'low' as const,
      },
      assigneeChange: {
        assigneeEmail: 'newassignee@example.com',
      },
    },
    invalid: {
      emptyTitle: {
        title: '',
        description: 'Invalid task with empty title',
      },
      invalidEmail: {
        title: 'Valid title',
        assigneeEmail: 'invalid-email',
      },
      invalidPriority: {
        title: 'Valid title',
        priority: 'invalid_priority',
      },
    },
  }

  // Expected API response fixtures
  public responses = {
    tasks: {
      todoTask: {
        ...this.data.todoTask,
        createdAt: this.data.todoTask.createdAt.toISOString(),
        updatedAt: this.data.todoTask.updatedAt.toISOString(),
        dueDate: this.data.todoTask.dueDate?.toISOString() || null,
      },
      inProgressTask: {
        ...this.data.inProgressTask,
        createdAt: this.data.inProgressTask.createdAt.toISOString(),
        updatedAt: this.data.inProgressTask.updatedAt.toISOString(),
        dueDate: this.data.inProgressTask.dueDate?.toISOString() || null,
      },
      completedTask: {
        ...this.data.completedTask,
        createdAt: this.data.completedTask.createdAt.toISOString(),
        updatedAt: this.data.completedTask.updatedAt.toISOString(),
        dueDate: this.data.completedTask.dueDate,
      },
    },
    created: {
      fromValidRequest: {
        id: expect.any(String),
        title: 'New task',
        description: 'Task description',
        status: 'todo',
        priority: 'medium',
        assigneeEmail: 'test@example.com',
        dueDate: '2024-12-01T00:00:00.000Z',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      fromMinimalRequest: {
        id: expect.any(String),
        title: 'Minimal task',
        description: null,
        status: 'todo',
        priority: 'medium',
        assigneeEmail: null,
        dueDate: null,
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    },
    updated: {
      statusChanged: {
        ...this.data.todoTask,
        status: 'in_progress',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        dueDate: this.data.todoTask.dueDate?.toISOString() || null,
      },
    },
    errors: {
      notFound: {
        statusCode: 404,
        message: 'Task not found',
      },
      validationError: {
        statusCode: 400,
      },
      invalidUuid: {
        statusCode: 400,
      },
    },
  }

  public queries = {
    byStatus: {
      todo: { status: 'todo' },
      inProgress: { status: 'in_progress' },
      completed: { status: 'completed' },
    },
    byAssignee: {
      john: { assignee: 'john@example.com' },
      jane: { assignee: 'jane@example.com' },
    },
    withPagination: {
      firstPage: { limit: 2, offset: 0 },
      secondPage: { limit: 2, offset: 2 },
    },
  }
}
```

### Integration Tests

```typescript
// test/integration/task-api.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createTestFastifyInstance, cleanupFastifyInstance } from '@rhds/api'
import { createDbClient } from '../src/db/client'
import { tasks } from '../src/db/schema'
import { TaskFixture } from '../src/fixtures/task.fixture'
import { FixtureLoader } from '@rhds/api'
import { registerTaskRoutes } from '../src/routes/task.routes'

describe('Task API Integration Tests', () => {
  let fastify: FastifyInstance
  let db: NodePgDatabase<{ tasks: typeof tasks }>
  let pool: Pool
  let fixtureLoader: FixtureLoader<typeof tasks, { tasks: typeof tasks }>
  
  const taskFixture = new TaskFixture()
  const { requests, responses, queries } = taskFixture

  beforeAll(async () => {
    // Setup database
    const dbClient = createDbClient({ schema: { tasks } })
    db = dbClient.db
    pool = dbClient.pool

    // Create test table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        status task_status DEFAULT 'todo' NOT NULL,
        priority task_priority DEFAULT 'medium' NOT NULL,
        assignee_email TEXT,
        due_date TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `)

    // Setup fixtures
    fixtureLoader = new FixtureLoader(db)
    fixtureLoader.addFixture(taskFixture)

    // Setup Fastify
    fastify = await createTestFastifyInstance()
    registerTaskRoutes(fastify)
  })

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS tasks')
    await pool.end()
    await cleanupFastifyInstance(fastify)
  })

  beforeEach(async () => {
    await fixtureLoader.loadAll()
  })

  afterEach(async () => {
    await fixtureLoader.clearAll()
  })

  describe('GET /tasks', () => {
    it('should return all tasks', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/tasks',
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.body)
      expect(result.tasks).toHaveLength(3)
      expect(result.total).toBe(3)
      expect(result.hasMore).toBe(false)
    })

    it('should filter tasks by status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/tasks',
        query: queries.byStatus.todo,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.body)
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].status).toBe('todo')
    })

    it('should filter tasks by assignee', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/tasks',
        query: queries.byAssignee.john,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.body)
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].assigneeEmail).toBe('john@example.com')
    })
  })

  describe('POST /tasks', () => {
    it('should create a task with valid data', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/tasks',
        payload: requests.create.valid,
      })

      expect(response.statusCode).toBe(200)
      const created = JSON.parse(response.body)
      expect(created).toEqual(responses.created.fromValidRequest)
    })

    it('should create a minimal task', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/tasks',
        payload: requests.create.minimal,
      })

      expect(response.statusCode).toBe(200)
      const created = JSON.parse(response.body)
      expect(created).toEqual(responses.created.fromMinimalRequest)
    })

    it('should reject invalid data', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/tasks',
        payload: requests.invalid.emptyTitle,
      })

      expect(response.statusCode).toBe(responses.errors.validationError.statusCode)
    })
  })

  describe('PUT /tasks/:id', () => {
    it('should update task status', async () => {
      const taskId = taskFixture.data.todoTask.id

      const response = await fastify.inject({
        method: 'PUT',
        url: `/tasks/${taskId}`,
        payload: requests.update.statusChange,
      })

      expect(response.statusCode).toBe(200)
      const updated = JSON.parse(response.body)
      expect(updated).toEqual(responses.updated.statusChanged)
    })
  })

  describe('POST /tasks/:id/complete', () => {
    it('should mark task as completed', async () => {
      const taskId = taskFixture.data.todoTask.id

      const response = await fastify.inject({
        method: 'POST',
        url: `/tasks/${taskId}/complete`,
      })

      expect(response.statusCode).toBe(200)
      const completed = JSON.parse(response.body)
      expect(completed.status).toBe('completed')
    })
  })
})
```

## OpenAI Client Integration

The OpenAI client provides type-safe AI integration with support for streaming, tool calls, and conversation management.

### Basic Setup

```typescript
// src/repositories/ai.service.ts
import { createOpenAiClient, type OpenAiClientConfig } from '@rhds/api'

export class AIRepository {
  private client

  constructor(config?: Partial<OpenAiClientConfig>) {
    this.client = createOpenAiClient({
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      ...config,
    })
  }

  async generateTaskSummary(tasks: Task[]): Promise<string> {
    const taskList = tasks.map(task => 
      `- ${task.title} (${task.status}, ${task.priority})`
    ).join('\n')

    const response = await this.client
      .resetMessages()
      .addSystemMessage('You are a helpful assistant that creates concise task summaries.')
      .addUserMessage(`Please summarize these tasks:\n${taskList}`)
      .send()

    return response.choices[0].message.content || 'No summary available'
  }

  async askAboutTask(taskId: string, question: string): Promise<string> {
    // Retrieve task context
    const taskRepository = new TaskRepository()
    const task = await taskRepository.getById(taskId)
    
    if (!task) {
      throw new Error('Task not found')
    }

    const response = await this.client
      .resetMessages()
      .addSystemMessage(`You are a helpful assistant with access to task information. 
        Current task: "${task.title}"
        Status: ${task.status}
        Priority: ${task.priority}
        Description: ${task.description || 'No description'}
        Due date: ${task.dueDate?.toISOString() || 'No due date'}`)
      .addUserMessage(question)
      .send()

    return response.choices[0].message.content || 'No response available'
  }
}
```

### Advanced: Multi-Message Conversations

```typescript
// src/repositories/conversation.service.ts
import { createOpenAiClient, type ChatMessage } from '@rhds/api'

export class ConversationRepository {
  private client

  constructor() {
    this.client = createOpenAiClient({
      model: 'gpt-4',
      temperature: 0.7,
    })
  }

  async startTaskConversation(userId: string, tasks: Task[]): Promise<string> {
    const context = this.buildTaskContext(tasks)
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a task management assistant for user ${userId}. 
          Help them manage their tasks effectively. Be concise and actionable.
          
          Current tasks:
          ${context}`
      },
      {
        role: 'user', 
        content: 'Hi! Can you help me prioritize my tasks for today?'
      }
    ]

    const response = await this.client
      .resetMessages()
      .addMessages(messages)
      .send()

    return response.choices[0].message.content || 'No response available'
  }

  async continueConversation(
    conversationHistory: ChatMessage[], 
    newMessage: string
  ): Promise<string> {
    const response = await this.client
      .resetMessages()
      .addMessages(conversationHistory)
      .addUserMessage(newMessage)
      .send()

    return response.choices[0].message.content || 'No response available'
  }

  private buildTaskContext(tasks: Task[]): string {
    return tasks.map(task => 
      `- [${task.status}] ${task.title} (Priority: ${task.priority}${
        task.dueDate ? `, Due: ${task.dueDate.toLocaleDateString()}` : ''
      })`
    ).join('\n')
  }
}
```

### Streaming Responses

```typescript
// src/routes/ai.routes.ts
export function registerAIRoutes(fastify: FastifyInstance) {
  const routes = createRouteRegistry(fastify)
  const aiRepository = new AIRepository()

  routes.get('/tasks/:id/chat', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({ question: z.string() }),
    },
  }, async ({ params, query, reply }) => {
    const client = createOpenAiClient({
      model: 'gpt-4',
      temperature: 0.7,
    })

    // Get task context
    const taskRepository = new TaskRepository()
    const task = await taskRepository.getById(params.id)
    
    if (!task) {
      throw new Error('Task not found')
    }

    // Setup streaming response
    reply.type('text/plain')
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
    })

    try {
      const stream = await client
        .resetMessages()
        .addSystemMessage(`You are a helpful assistant with access to task information.
          Task: "${task.title}"
          Status: ${task.status}
          Priority: ${task.priority}
          Description: ${task.description || 'No description'}`)
        .addUserMessage(query.question)
        .stream()

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          reply.raw.write(content)
        }
      }
    } catch (error) {
      reply.raw.write(`Error: ${error.message}`)
    } finally {
      reply.raw.end()
    }
  })
}
```

### Tool Calling Example

```typescript
// src/repositories/ai-tools.service.ts
import { createOpenAiClient, type ToolCall } from '@rhds/api'
import { z } from 'zod'

export class AIToolsRepository {
  private client
  private taskRepository: TaskRepository

  constructor() {
    this.client = createOpenAiClient({
      model: 'gpt-4',
      temperature: 0.3,
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_task',
            description: 'Create a new task',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Task description' },
                priority: { 
                  type: 'string', 
                  enum: ['low', 'medium', 'high', 'urgent'],
                  description: 'Task priority'
                },
                dueDate: { type: 'string', description: 'Due date in ISO format' },
              },
              required: ['title'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'update_task_status',
            description: 'Update the status of an existing task',
            parameters: {
              type: 'object',
              properties: {
                taskId: { type: 'string', description: 'Task ID' },
                status: {
                  type: 'string',
                  enum: ['todo', 'in_progress', 'completed', 'cancelled'],
                  description: 'New task status'
                },
              },
              required: ['taskId', 'status'],
            },
          },
        },
      ],
      toolChoice: 'auto',
    })
    
    this.taskRepository = new TaskRepository()
  }

  async processTaskRequest(userInput: string): Promise<string> {
    const response = await this.client
      .resetMessages()
      .addSystemMessage('You are a task management assistant. Use the available tools to help users manage their tasks.')
      .addUserMessage(userInput)
      .send()

    if (response.choices[0].finish_reason === 'tool_calls') {
      const toolCalls = response.choices[0].message.tool_calls || []
      
      // Process each tool call
      for (const toolCall of toolCalls) {
        const toolResponse = await this.handleToolCall(toolCall)
        this.client.addToolResponse(toolCall.id, JSON.stringify(toolResponse))
      }

      // Get final response after tool execution
      const finalResponse = await this.client.send()
      return finalResponse.choices[0].message.content || 'Task completed'
    }

    return response.choices[0].message.content || 'I can help you manage tasks. Try asking me to create or update tasks.'
  }

  private async handleToolCall(toolCall: ToolCall) {
    switch (toolCall.function.name) {
      case 'create_task':
        return await this.handleCreateTask(toolCall)
      case 'update_task_status':
        return await this.handleUpdateTaskStatus(toolCall)
      default:
        throw new Error(`Unknown tool: ${toolCall.function.name}`)
    }
  }

  private async handleCreateTask(toolCall: ToolCall) {
    const argsSchema = z.object({
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      dueDate: z.string().optional(),
    })

    return await OpenAiClient.handleToolCall(
      toolCall,
      argsSchema,
      async (args) => {
        const task = await this.taskRepository.create({
          title: args.title,
          description: args.description,
          priority: args.priority,
          dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
        })

        return {
          success: true,
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
          },
        }
      }
    )
  }

  private async handleUpdateTaskStatus(toolCall: ToolCall) {
    const argsSchema = z.object({
      taskId: z.string().uuid(),
      status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']),
    })

    return await OpenAiClient.handleToolCall(
      toolCall,
      argsSchema,
      async (args) => {
        const task = await this.taskRepository.update(args.taskId, {
          status: args.status,
        })

        if (!task) {
          return { success: false, error: 'Task not found' }
        }

        return {
          success: true,
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
          },
        }
      }
    )
  }
}
```

## Putting It All Together

### Main Application Setup

```typescript
// src/app.ts
import Fastify from 'fastify'
import { registerTaskRoutes } from './routes/task.routes'
import { registerAIRoutes } from './routes/ai.routes'

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // Register error handling
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500
    
    reply.status(statusCode).send({
      error: true,
      message: error.message,
      statusCode,
    })
  })

  // Register routes
  await fastify.register(async (fastify) => {
    registerTaskRoutes(fastify)
  }, { prefix: '/api/v1' })

  await fastify.register(async (fastify) => {
    registerAIRoutes(fastify)
  }, { prefix: '/api/v1' })

  return fastify
}

// src/server.ts
import { createApp } from './app'

async function start() {
  try {
    const app = await createApp()
    
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0',
    })

    console.log('Server started successfully')
  } catch (error) {
    console.error('Error starting server:', error)
    process.exit(1)
  }
}

start()
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run test/integration",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Best Practices

### 1. Type Safety
- Always use Drizzle schemas for database operations
- Generate Zod schemas from Drizzle for consistent validation
- Use TypeScript strict mode for maximum type safety

### 2. Error Handling
- Use consistent error response formats
- Implement proper HTTP status codes
- Add request/response validation at API boundaries

### 3. Testing
- Write integration tests for all API endpoints
- Use fixtures for consistent test data
- Test both success and error scenarios
- Aim for high test coverage (>90%)

### 4. Performance
- Use database indexes for frequently queried fields
- Implement proper pagination for list endpoints
- Consider caching strategies for read-heavy operations

### 5. Security
- Validate all user input with Zod schemas
- Use parameterized queries (handled by Drizzle)
- Implement proper authentication and authorization
- Never expose sensitive data in API responses

## OpenAPI Documentation & Traffic Auditing

The RHDS API Toolkit includes powerful tools for generating OpenAPI documentation from your routes and auditing actual API traffic against your specification. This ensures your documentation stays in sync with reality.

### Setting Up OpenAPI Documentation

The toolkit automatically generates OpenAPI schemas from your route definitions using Zod schema validation:

```typescript
// Integration tests automatically generate OpenAPI specs
import { 
  createTestFastifyInstance, 
  trafficRecorder, 
  writeTraffic 
} from '@rhds/api'
import { OpenApiTrafficAuditor } from '@rhds/api'

describe('Task API Integration Tests', () => {
  let fastify: FastifyInstance

  beforeAll(async () => {
    // Create Fastify instance with traffic recording
    fastify = await createTestFastifyInstance({
      plugins: [trafficRecorder], // Records all requests/responses
    })
    
    registerTaskRoutes(fastify) // Your routes with Zod schemas
  })

  afterAll(async () => {
    // Write captured traffic to JSON file
    const trafficFile = await writeTraffic(fastify, __filename)
    
    // Generate audit report comparing spec vs actual traffic
    const auditor = new OpenApiTrafficAuditor(
      path.resolve(__dirname, '../generated/openapi-schema.json'),
      path.resolve(__dirname, '../generated/traffic')
    )
    
    const reportPath = path.resolve(__dirname, '../generated/audit-report.md')
    await auditor.generateMarkdownReport(reportPath)
    
    console.log(`Audit report written to ${path.relative(process.cwd(), reportPath)}`)
  })

  // Your integration tests...
})
```

### Traffic Recording During Tests

The traffic recorder plugin captures all HTTP requests and responses during integration tests:

```typescript
// Automatically captures:
{
  "method": "POST",
  "url": "/api/tasks",
  "request": {
    "title": "New task",
    "priority": "high"
  },
  "response": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "New task", 
    "status": "todo",
    "priority": "high",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "status": 200
}
```

### OpenAPI Schema Generation

Routes with Zod schemas automatically generate OpenAPI specifications:

```typescript
// This route definition...
routes.post('/tasks', {
  schema: {
    body: TaskCreateSchema,        // Zod schema
    response: {
      200: TaskResponseSchema,     // Zod schema  
    },
  },
}, async ({ body }) => {
  // Handler implementation
})

// Automatically generates this OpenAPI spec:
{
  "paths": {
    "/tasks": {
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "title": { "type": "string", "minLength": 1 },
                  "priority": { "type": "string", "enum": ["low", "medium", "high"] }
                },
                "required": ["title"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "object", 
                  "properties": {
                    "id": { "type": "string", "format": "uuid" },
                    "title": { "type": "string" },
                    "status": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Audit Report Generation

The auditor compares your OpenAPI specification against actual traffic captured during tests:

```markdown
# OpenAPI vs Traffic Audit

Spec file: `generated/openapi-schema.json`
Traffic dir: `generated/traffic`

## Undocumented (seen in traffic, not in OpenAPI)

| Method | Path | Status |
| ------ | ---- | ------ |
| POST | /api/tasks | 400 |
| PUT | /api/tasks/invalid-uuid | 400 |

## Untested (in OpenAPI, not seen in traffic)

| Method | Path | Status |
| ------ | ---- | ------ |
| PUT | /api/tasks/{id} | 404 |
| DELETE | /api/tasks/{id} | 404 |
```

### Complete Workflow

Here's how to integrate OpenAPI documentation and auditing into your development workflow:

1. **Write Integration Tests** with traffic recording:
```typescript
// test/integration/task-api.test.ts
import { trafficRecorder, writeTraffic, OpenApiTrafficAuditor } from '@rhds/api'

describe('Task API', () => {
  beforeAll(async () => {
    fastify = await createTestFastifyInstance({
      plugins: [trafficRecorder],
    })
    registerTaskRoutes(fastify)
  })

  afterAll(async () => {
    // Write traffic and generate audit
    await writeTraffic(fastify, __filename)
    
    const auditor = new OpenApiTrafficAuditor(
      './generated/openapi-schema.json',
      './generated/traffic'
    )
    await auditor.generateMarkdownReport('./generated/audit-report.md')
  })

  // Test all your endpoints, including error cases
  it('should handle validation errors', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { /* invalid data */ },
    })
    expect(response.statusCode).toBe(400)
  })
})
```

2. **Run Tests** to capture traffic and generate documentation:
```bash
# Run integration tests (captures traffic + generates OpenAPI)
pnpm test:integration

# Check the generated files
ls generated/
# openapi-schema.json  - Auto-generated OpenAPI spec
# traffic/            - Captured request/response data
# audit-report.md     - Coverage analysis
```

3. **Review Audit Results** to ensure complete API coverage:
   - **Undocumented endpoints**: Traffic seen but not in OpenAPI spec (usually error cases)
   - **Untested endpoints**: Spec defines but no traffic captured (missing test cases)

4. **Add Missing Tests** for complete coverage:
```typescript
// Add tests for 404 scenarios
it('should return 404 for non-existent task', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/api/tasks/123e4567-e89b-12d3-a456-426614174999', // Non-existent ID
  })
  expect(response.statusCode).toBe(404)
})
```

### Benefits

- **Documentation Always Up-to-Date**: Generated from actual code, never stale
- **API Coverage Validation**: Ensures all endpoints are tested 
- **Specification Accuracy**: Real traffic validates your OpenAPI spec
- **Error Case Documentation**: Captures 400/404/500 responses automatically
- **Integration Testing**: Verifies actual request/response schemas match expectations

The auditing process helps you achieve comprehensive API testing and documentation that developers can trust! 📋✅

## Conclusion

The RHDS API Toolkit provides a comprehensive foundation for building robust, type-safe APIs. By following this guide, you'll have:

- ✅ Type-safe database operations with Drizzle
- ✅ Comprehensive validation with Zod schemas  
- ✅ Well-tested API endpoints using fixtures
- ✅ AI integration capabilities with OpenAI
- ✅ Streaming support for real-time features
- ✅ Tool calling for advanced AI interactions
- ✅ Automated OpenAPI documentation and traffic auditing

The toolkit handles the boilerplate so you can focus on building great features. Each component is designed to work together seamlessly while remaining flexible enough to adapt to your specific needs.

Ready to build your next API? Start with the database schema and work your way up through repositories, validation, and routes. The type system will guide you every step of the way! 🚀