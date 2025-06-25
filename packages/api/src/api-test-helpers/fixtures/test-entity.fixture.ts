import { BaseFixture } from '../../core/base-fixture'
import { testEntities, type TestEntity } from '../schemas/test-entity.schema'
import { expect } from 'vitest'

export class TestEntityFixture extends BaseFixture<
  typeof testEntities,
  { testEntities: typeof testEntities }
> {
  public schema = testEntities

  public data: Record<string, TestEntity> = {
    testEntity1: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test Entity One',
      description: 'First test entity for integration testing',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
    testEntity2: {
      id: '123e4567-e89b-12d3-a456-426614174002',
      name: 'Test Entity Two',
      description: 'Second test entity for integration testing',
      isActive: false,
      createdAt: new Date('2024-01-02T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    },
    testEntity3: {
      id: '123e4567-e89b-12d3-a456-426614174003',
      name: 'Test Entity Three',
      description: null,
      isActive: true,
      createdAt: new Date('2024-01-03T00:00:00Z'),
      updatedAt: new Date('2024-01-03T00:00:00Z'),
    },
  }

  // API operation fixtures for testing requests, responses, and errors
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
      withOptionalFields: {
        name: 'Entity with Description',
        description: 'This entity has a description',
        isActive: false,
      },
    },
    update: {
      nameOnly: {
        name: 'Updated Name',
      },
      fullUpdate: {
        name: 'Fully Updated Entity',
        description: 'Updated description',
        isActive: false,
      },
      setInactive: {
        isActive: false,
      },
      clearDescription: {
        description: undefined,
      },
    },
    invalid: {
      emptyName: {
        name: '',
        description: 'Invalid: empty name',
      },
      missingName: {
        description: 'Invalid: missing name',
        isActive: true,
      },
      invalidType: {
        name: 'Valid Name',
        isActive: 'not a boolean', // Type error
      },
    },
  }

  public responses = {
    entities: {
      testEntity1: {
        ...this.data.testEntity1,
        createdAt: this.data.testEntity1.createdAt.toISOString(),
        updatedAt: this.data.testEntity1.updatedAt.toISOString(),
      },
      testEntity2: {
        ...this.data.testEntity2,
        createdAt: this.data.testEntity2.createdAt.toISOString(),
        updatedAt: this.data.testEntity2.updatedAt.toISOString(),
      },
      testEntity3: {
        ...this.data.testEntity3,
        createdAt: this.data.testEntity3.createdAt.toISOString(),
        updatedAt: this.data.testEntity3.updatedAt.toISOString(),
      },
    },
    created: {
      fromValidRequest: {
        id: expect.any(String),
        name: 'New Test Entity',
        description: 'Created via API',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      fromMinimalRequest: {
        id: expect.any(String),
        name: 'Minimal Entity',
        description: null,
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      fromOptionalFieldsRequest: {
        id: expect.any(String),
        name: 'Entity with Description',
        description: 'This entity has a description',
        isActive: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    },
    updated: {
      nameOnlyUpdate: {
        ...this.data.testEntity2,
        name: 'Updated Name',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      fullUpdate: {
        ...this.data.testEntity3,
        name: 'Fully Updated Entity',
        description: 'Updated description',
        isActive: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    },
    errors: {
      notFound: {
        statusCode: 404,
        message: 'Entity not found',
      },
      validationError: {
        statusCode: 400,
      },
      invalidUuid: {
        statusCode: 400,
      },
    },
  }
}
