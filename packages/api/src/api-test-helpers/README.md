# API Test Helpers - Expanded Fixture System

This document explains how to use the expanded BaseFixture system with support for API operation fixtures including requests, responses, and error scenarios.

## Overview

The `BaseFixture` has been expanded to include:

1. **Typed API operation fixtures** for requests, responses, and errors
2. **`expect.any()` matchers** for generated fields (IDs, timestamps)
3. **Helper methods** for creating response expectations with flexible field matching

## BaseFixture Structure

```typescript
interface ApiOperationFixtures<TEntity, TCreateRequest, TUpdateRequest> {
  requests: {
    create: Record<string, TCreateRequest>
    update: Record<string, TUpdateRequest>
    invalid: Record<string, any> // For testing validation failures
  }
  responses: {
    entities: Record<string, TEntity> // Expected responses with matchers for generated fields
    created: Record<string, TEntity>
    updated: Record<string, TEntity>
    errors: Record<string, { statusCode: number; message?: string }>
  }
}
```

## Using expect.any() Matchers for Generated Fields

The key innovation is using vitest's `expect.any()` asymmetric matchers directly in fixture data to handle dynamically generated fields like UUIDs and timestamps.

### Example Usage

```typescript
// In your fixture
public responses = {
  created: {
    fromValidRequest: this.createEntityResponse<TestEntity>({
      name: 'New Test Entity',
      description: 'Created via API',
      isActive: true,
    }),
    // Expands to:
    // {
    //   id: expect.any(String),
    //   name: 'New Test Entity', 
    //   description: 'Created via API',
    //   isActive: true,
    //   createdAt: expect.any(String),
    //   updatedAt: expect.any(String),
    // }
  }
}

// In your test
const response = await fastify.inject({
  method: 'POST',
  url: '/api/test-entities',
  payload: fixture.requests.create.valid,
})

const created = JSON.parse(response.body)
expect(created).toEqual(fixture.responses.created.fromValidRequest)
```

## Complete Example: TestEntityFixture

```typescript
export class TestEntityFixture extends BaseFixture<
  typeof testEntities,
  { testEntities: typeof testEntities }
> implements ApiOperationFixtures<TestEntity, TestEntityCreateRequest, TestEntityUpdateRequest> {
  
  // Database seed data (for beforeEach/afterEach)
  public data = {
    testEntity1: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test Entity One',
      // ... other fields
    },
  }

  // API request fixtures
  public requests = {
    create: {
      valid: {
        name: 'New Test Entity',
        description: 'Created via API',
        isActive: true,
      },
      minimal: {
        name: 'Minimal Entity',
      },
    },
    update: {
      nameOnly: {
        name: 'Updated Name',
      },
    },
    invalid: {
      emptyName: {
        name: '',
        description: 'Invalid: empty name',
      },
    },
  }

  // API response fixtures  
  public responses = {
    // For known entities with fixed timestamps
    entities: {
      testEntity1: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Entity One',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        // ...
      },
    },
    // For newly created entities with generated fields
    created: {
      fromValidRequest: this.createEntityResponse<TestEntity>({
        name: 'New Test Entity',
        description: 'Created via API', 
        isActive: true,
      }),
    },
    // For updated entities (known ID, generated updatedAt)
    updated: {
      nameOnlyUpdate: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Updated Name',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: expect.any(String), // Will be updated
        // ...
      },
    },
    // Error responses
    errors: {
      notFound: {
        statusCode: 404,
        message: 'Entity not found',
      },
      validationError: {
        statusCode: 400,
      },
    },
  }
}
```

## Test Patterns

### 1. Testing POST (Create) Operations

```typescript
it('should create entity via POST', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/api/test-entities',
    payload: fixture.requests.create.valid,
  })

  expect(response.statusCode).toBe(200)
  const created = JSON.parse(response.body)
  
  // Uses expect.any() for id, createdAt, updatedAt
  expect(created).toEqual(fixture.responses.created.fromValidRequest)
})
```

### 2. Testing PUT (Update) Operations

```typescript
it('should update entity via PUT', async () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002'
  
  const response = await fastify.inject({
    method: 'PUT',
    url: `/api/test-entities/${entityId}`,
    payload: fixture.requests.update.nameOnly,
  })

  expect(response.statusCode).toBe(200)
  const updated = JSON.parse(response.body)
  
  // Uses expect.any() for updatedAt, keeps known createdAt
  expect(updated).toEqual(fixture.responses.updated.nameOnlyUpdate)
})
```

### 3. Testing Validation Errors

```typescript
it('should return 400 for invalid data', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/api/test-entities',
    payload: fixture.requests.invalid.emptyName,
  })

  expect(response.statusCode).toBe(fixture.responses.errors.validationError.statusCode)
})
```

### 4. Testing GET Operations with Known Data

```typescript
it('should get entity by ID', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: `/api/test-entities/${fixture.data.testEntity1.id}`,
  })

  expect(response.statusCode).toBe(200)
  const entity = JSON.parse(response.body)
  
  // Exact match for known entity
  expect(entity).toEqual(fixture.responses.entities.testEntity1)
})
```

## Helper Methods

### createEntityResponse()

Creates response objects with configurable matchers for generated fields:

```typescript
protected createEntityResponse<TEntity>(
  baseEntity: Partial<TEntity>,
  options: {
    useGeneratedId?: boolean       // Default: true
    useGeneratedTimestamps?: boolean // Default: true  
  } = {}
): TEntity
```

**Usage:**
```typescript
// Full generation (id, createdAt, updatedAt use expect.any())
this.createEntityResponse({ name: 'Test' })

// Known ID, generated timestamps
this.createEntityResponse({ id: 'known-id', name: 'Test' }, { 
  useGeneratedId: false 
})

// All fields known (no matchers)
this.createEntityResponse({ 
  id: 'known-id', 
  name: 'Test',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
}, { 
  useGeneratedId: false, 
  useGeneratedTimestamps: false 
})
```

## Benefits

1. **Type Safety**: All request/response fixtures are fully typed
2. **DRY Principle**: Reusable request/response patterns across tests  
3. **Flexible Matching**: Handle both known and generated field values
4. **Documentation**: Fixtures serve as examples of valid API operations
5. **Maintainability**: Centralized test data reduces duplication

## Migration from Old Fixtures

1. Keep existing `data` property for database seeding
2. Add `requests` and `responses` properties using the new structure
3. Use `createEntityResponse()` helper for generated field scenarios
4. Replace manual response construction with fixture references in tests