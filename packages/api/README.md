# @rhds/api

Shared utilities for building type-safe Fastify APIs in the RHDS monorepo.

## Features

- **BaseRepository**: Generic CRUD repository class with type-safe database operations
- **BaseFixture**: Enhanced test data fixtures with time tracking and automatic cleanup
- **FixtureLoader**: Multi-fixture management with batch operations
- **Route Registry**: Type-safe route registration with Zod schema validation
- **Schema Builder**: Utility for generating consistent API schemas
- **OpenAI Client**: Type-safe OpenAI API wrapper with tool support
- **Repository Pattern**: Data access layer with consistent CRUD operations
- **Test Utilities**: Comprehensive database integration testing with minimal Fastify setup

## Installation

```bash
pnpm add @rhds/api
```

## Usage

### Basic Repository

```typescript
import { BaseRepository } from '@rhds/api'
import { db } from './db/client'
import { users } from './db/schema'

class UserRepository extends BaseRepository<typeof users> {
    constructor() {
        super(db, users)
    }
}
```

### Route Registration

```typescript
import { createRouteRegistry, SchemaBuilder } from '@rhds/api'
import { z } from 'zod'

const routes = createRouteRegistry(fastify)

routes.get('/users/:id', SchemaBuilder.getById(UserSchema), async ({ params, services }) => {
    return services.userService.getById(params.id)
})
```

### Service Plugin

```typescript
// Repository pattern - direct injection or dependency container

const repositories = {
    userRepository: new UserRepository(db, users)
}

// Inject repositories into Fastify instance
fastify.decorate('repositories', repositories)
```

### Testing with Fixtures

```typescript
import { BaseFixture, FixtureLoader } from '@rhds/api'

// Create a test fixture
class UserFixture extends BaseFixture<typeof users, { users: typeof users }> {
    public schema = users
    public data = {
        user1: { id: '123...', name: 'Test User', email: 'test@example.com' },
        user2: { id: '456...', name: 'Another User', email: 'another@example.com' }
    }
}

// Use fixture loader for multiple fixtures
const fixtureLoader = new FixtureLoader(db)
    .addFixture(new UserFixture())
    .addFixtures([new PostFixture(), new CommentFixture()])

// In your tests
beforeEach(async () => {
    await fixtureLoader.loadAll()
})

afterEach(async () => {
    await fixtureLoader.clearAll()
})
```

## Testing

The package includes comprehensive testing infrastructure with both unit and integration tests:

### Available Test Commands

```bash
# Run unit tests only (default)
pnpm test

# Run integration tests only  
pnpm test:integration

# Run all tests (unit + integration)
pnpm test:all

# Generate coverage report for unit tests
pnpm test:coverage

# Generate coverage report for all tests
pnpm test:coverage:all
```

### Test Structure

- **Unit Tests**: Fast, isolated tests using mocks and stubs
- **Integration Tests**: Database-connected tests with real PostgreSQL instances
- **Test Utilities**: Shared fixtures, database setup, and cleanup helpers

### Coverage Reporting

The test suite uses Vitest with v8 coverage provider and includes:

- Line, branch, function, and statement coverage
- AST-aware source map remapping for accurate coverage
- Exclusion of build artifacts, config files, and index files
- Color-preserved terminal output via Moon task orchestration

### BaseFixture Enhanced Features

- **Time Tracking**: Automatic test start time tracking for precise cleanup
- **Dual Cleanup Strategy**: Clears both known fixture IDs and time-based records
- **Table Flexibility**: Works with tables both with and without `createdAt` columns
- **Manual Time Control**: `markTestStart()` method for custom time boundaries

### FixtureLoader Capabilities

- **Multi-Fixture Management**: Load and clear multiple fixtures as a batch
- **Method Chaining**: Fluent API for fixture setup
- **Batch Operations**: `loadAll()`, `clearAll()`, and `reloadAll()` methods
- **Order Independence**: Automatic cleanup in reverse order for referential integrity

## Architecture

The package follows a layered architecture with clear separation of concerns:

- **Core**: Base classes and utilities (`BaseService`, `BaseFixture`, etc.)
- **Plugins**: Fastify plugins for dependency injection  
- **Testing**: Comprehensive test infrastructure with database integration
- **Database**: Drizzle ORM integration with schema validation

All utilities are designed to work together while remaining modular and reusable across different API services.