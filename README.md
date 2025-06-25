# RHDS Monorepo

A modern, type-safe monorepo built with Moon, pnpm, and PostgreSQL multi-tenancy.

## 🏗️ Architecture

This monorepo provides a foundation for building scalable applications with:

- **Shared Component Library** (`@rhds/ui`) - React components with comprehensive theming
- **API Utilities** (`@rhds/api`) - Type-safe Fastify patterns and database utilities  
- **Multi-Tenant Database** - Single PostgreSQL instance with schema-based project isolation
- **Environment Inheritance** - Hierarchical configuration through Moon

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v23.7.0 (specified in `engines`)
- **pnpm**: v10.2.1 (specified in `packageManager`)
- **Docker**: For PostgreSQL database

### Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the database:**
   ```bash
   pnpm db:start
   ```

3. **Initialize environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

4. **Initialize a project schema** (for new projects):
   ```bash
   pnpm db:init my-project-name
   ```

## 📦 Packages

### API Package (`@rhds/api`)

Shared utilities for building type-safe Fastify APIs.

**Features:**
- Multi-tenant PostgreSQL with schema isolation
- Type-safe Drizzle ORM integration
- Fastify service patterns and route registry
- OpenAI client wrapper with tool support
- Comprehensive test utilities

**Commands:**
```bash
# Development  
pnpm build:api        # Build API package
pnpm test:api         # Run API tests
pnpm test:coverage    # Generate coverage report
```

## 🗄️ Database Architecture

### Multi-Tenant PostgreSQL

The monorepo uses a single PostgreSQL instance with schema-based isolation:

- **Global Database**: Shared PostgreSQL container
- **Project Schemas**: Each project gets its own schema (`user_service`, `order_service`, etc.)
- **Automatic Management**: Scripts handle schema creation and initialization

### Environment Configuration

Environment variables follow a hierarchical inheritance pattern:

```
rhds-monorepo/
├── .env                    # Global DB config (POSTGRES_USER, etc.)
├── .moon/workspace.yml     # Inherits root .env
└── my-project/
    ├── moon.yml           # PROJECT_SCHEMA=my_project
    └── .env               # Optional project overrides
```

**Global Variables** (`.env`):
- `POSTGRES_USER` - Database user
- `POSTGRES_PASSWORD` - Database password  
- `POSTGRES_DB` - Database name
- `POSTGRES_HOST` - Database host (default: localhost)
- `POSTGRES_PORT` - Database port (default: 5432)

**Project Variables** (`project/moon.yml`):
- `PROJECT_SCHEMA` - PostgreSQL schema name for isolation

### Database Commands

```bash
# Database Management
pnpm db:start                    # Start PostgreSQL container
pnpm db:stop                     # Stop all database services

# Project-specific (run from project directory)
moon run db-migrate              # Run Drizzle migrations
moon run db-generate             # Generate migration files
moon run db-studio               # Launch Drizzle Studio GUI
moon run db-init-schema          # Initialize schema for project
```

### Using the Database in Your Project

1. **Create project configuration** (`my-project/moon.yml`):
   ```yaml
   language: 'typescript'
   type: 'application'
   
   env:
     PROJECT_SCHEMA: 'my_project'
   ```

2. **Initialize the schema:**
   ```bash
   pnpm db:init my-project
   ```

3. **Use in your code:**
   ```typescript
   import { createDbClientFromEnv, createDrizzleConfig } from '@rhds/api'
   import * as schema from './schema'
   
   // Database client (automatically uses inherited environment)
   const { db } = createDbClientFromEnv(schema)
   
   // Drizzle configuration
   const config = createDrizzleConfig({
       schemaPath: './src/db/schema.ts',
       projectSchema: 'my_project',
   })
   ```

## 🌙 Moon Tasks

The monorepo uses Moon for task orchestration with the following common tasks:

### Global Tasks (Available to all projects)

```bash
# Development
moon run :dev                    # Start development servers
moon run :build                  # Build all packages
moon run :type-check             # TypeScript checking
moon run :test                   # Run all tests
moon run :test-coverage          # Generate test coverage

# Code Quality
moon run :lint                   # ESLint
moon run :format                 # Biome formatting
moon run :check                  # Biome linting + formatting

# Database
moon run :db-start               # Start PostgreSQL
moon run :db-stop                # Stop database services
```

### Project-Specific Tasks

```bash
# From project directory
moon run dev                     # Project dev server
moon run build                   # Build project
moon run test                    # Project tests
moon run db-migrate              # Run migrations
moon run db-generate             # Generate migrations
```

### Task Dependencies

All major tasks automatically install dependencies when needed:
- `build` depends on `install`
- `test` depends on `install`  
- `db-migrate` depends on `install` and `db-start`

## 🧪 Testing

### Test Coverage

Generate coverage reports with multiple providers:

```bash
# Default (v8 with experimental AST-aware remapping)
pnpm test:coverage
moon run api:test-coverage

# View coverage reports
open packages/api/coverage/index.html
```

### Writing Tests

The API package provides comprehensive test utilities:

```typescript
import { createTestFastifyInstance, BaseFixture } from '@rhds/api'

// Test Fastify instance with automatic cleanup
const fastify = createTestFastifyInstance()

// Type-safe fixtures for database testing
class UserFixture extends BaseFixture<typeof users> {
    constructor() { super(db, users) }
}
```

## 🎨 Theming

The UI package includes a complete theming system:

```typescript
import { ThemeProvider, useTheme, ThemeControls } from '@rhds/ui'

// App setup
<ThemeProvider defaultTheme={{ colorPalette: 'blue', mode: 'light' }}>
  <App />
</ThemeProvider>

// Component usage
const { theme, updateTheme } = useTheme()

// Optional theme controls
<ThemeControls />
```

**Available Themes:**
- **Palettes**: Blue (default), Green, Purple, Amber
- **Modes**: Light (default), Dark
- **Accessibility**: High contrast mode

## 📝 Scripts Reference

### Root Level

```bash
pnpm dev              # -> moon run ui:dev
pnpm build            # -> moon run ui:build  
pnpm cosmos           # -> moon run ui:cosmos
pnpm type-check       # -> moon run :type-check
pnpm test             # -> moon run :test
pnpm test:api         # -> moon run api:test
pnpm build:api        # -> moon run api:build
pnpm db:start         # -> moon run :db-start
pnpm db:stop          # -> moon run :db-stop
pnpm db:init          # -> node scripts/init-project-schema.js
```

### Code Quality

```bash
pnpm lint             # Biome linting
pnpm format           # Biome formatting
pnpm check            # Biome linting + formatting
```

## 🔧 Development Workflow

1. **Start the database:**
   ```bash
   pnpm db:start
   ```

2. **Create a new project:**
   ```bash
   # Initialize schema
   pnpm db:init my-new-project
   
   # Create project structure
   mkdir apps/my-new-project
   
   # Add moon.yml with PROJECT_SCHEMA
   ```

3. **Develop:**
   ```bash
   # UI development
   pnpm dev
   
   # Component playground  
   pnpm cosmos
   
   # API development
   cd apps/my-new-project
   moon run dev
   ```

4. **Test & Build:**
   ```bash
   # Run tests with coverage
   pnpm test:coverage
   
   # Type checking
   pnpm type-check
   
   # Build everything
   pnpm build
   ```

## 📚 Additional Resources

- **Moon Documentation**: [moonrepo.dev](https://moonrepo.dev)
- **Drizzle ORM**: [orm.drizzle.team](https://orm.drizzle.team)
- **Fastify**: [fastify.dev](https://fastify.dev)
- **Radix UI**: [radix-ui.com](https://radix-ui.com)
- **React Cosmos**: [reactcosmos.org](https://reactcosmos.org)
