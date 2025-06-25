# API Package Backlog

## High Priority

### Incorporate drizzle-zod validation in BaseService
- **Description**: Add drizzle-zod schema validation to BaseService CRUD operations for database input validation
- **Rationale**: While API schemas handle request/response validation, we should also validate data going into the database to ensure type safety and data integrity at the service layer
- **Tasks**:
  - Add drizzle-zod dependency to BaseService constructor to accept optional validation schemas
  - Implement validation in `create()`, `update()` methods before database operations
  - Add error handling for validation failures
  - Update test coverage for validation scenarios
- **Benefits**: Provides defense-in-depth validation, catches type mismatches, prevents invalid data from reaching the database

## Medium Priority

### Response field filtering architecture
- **Description**: Implement automatic response field filtering based on response schemas
- **Current State**: Response schemas validate data but don't filter fields - database returns all fields even if response schema omits them
- **Options**:
  - Option A: Modify BaseService to accept and apply response schema filters
  - Option B: Add filtering middleware at the route level
  - Option C: Create wrapper functions that apply schema filtering after service calls
- **Example**: If response schema omits `updatedAt`, the API should automatically exclude it from responses
- **Impact**: Provides true separation between database schema and API contract

### Enhance error handling and response formatting
- **Description**: Standardize error responses across all routes and add proper error codes
- **Tasks**:
  - Create consistent error response schemas
  - Add error handling middleware for common scenarios
  - Implement proper HTTP status codes for different error types
  - Add error logging and monitoring hooks

### Add pagination support to BaseService
- **Description**: Implement standardized pagination for getAll operations
- **Tasks**:
  - Add pagination parameters to getAll method
  - Create pagination response schemas
  - Update SchemaBuilder to support pagination query parameters
  - Add cursor-based pagination option for large datasets

### Documentation and examples
- **Description**: Create comprehensive documentation and usage examples
- **Tasks**:
  - Add JSDoc comments to all public APIs
  - Create usage examples for common patterns
  - Document schema design best practices
  - Add migration guide from basic Fastify to this package

## Low Priority

### Performance optimizations
- **Description**: Optimize common database operations and schema validation
- **Tasks**:
  - Add connection pooling configuration options
  - Implement query result caching layer
  - Optimize JSON Schema generation performance
  - Add database query logging and performance monitoring

### Additional utility schemas
- **Description**: Add common validation schemas and utilities
- **Tasks**:
  - Add date range validation schemas
  - Create file upload validation schemas
  - Implement search/filter parameter schemas
  - Add internationalization support for error messages

## Completed

### Manual Zod schemas for API validation
- ✅ Separated API validation schemas from database schemas
- ✅ Created explicit request/response validation rules
- ✅ Added business logic constraints (non-empty names, no timestamp modification)
- ✅ Implemented proper field omission (updatedAt in responses, ID in updates)