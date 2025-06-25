import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest'
import { createDbClient } from '../../src/db/client'
import { testEntities } from '../../src/api-test-helpers/schemas/test-entity.schema'
import { TestEntityFixture } from '../../src/api-test-helpers/fixtures/test-entity.fixture'
import { FixtureLoader } from '../../src/testing/fixture-loader'
import { registerTestEntityRoutes } from '../../src/api-test-helpers/routes/test-entity.routes'
import {
  createTestFastifyInstance,
  cleanupFastifyInstance,
} from '../../src/api-test-helpers/fastify-test-instance'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'
import { auditor } from '../setup/auditor'

describe('Route Schema Integration Tests', () => {
  let db: NodePgDatabase<{ testEntities: typeof testEntities }>
  let pool: Pool
  let fastify: FastifyInstance
  let fixtureLoader: FixtureLoader<
    typeof testEntities,
    { testEntities: typeof testEntities }
  >
  const testEntityFixture = new TestEntityFixture()
  const { testEntity1, testEntity2, testEntity3 } = testEntityFixture.data
  const { requests, responses } = testEntityFixture

  beforeAll(async () => {
    // Create database connection for integration tests
    const dbClient = createDbClient({
      schema: { testEntities },
    })

    db = dbClient.db
    pool = dbClient.pool

    // Create the test table in the database
    await pool.query('DROP TABLE IF EXISTS api.test_entities')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api.test_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // Initialize fixture loader
    fixtureLoader = new FixtureLoader()
    fixtureLoader.addFixture(testEntityFixture)

    // Create Fastify instance with routes using SchemaBuilder
    fastify = await createTestFastifyInstance()

    // Register test entity routes
    registerTestEntityRoutes(fastify)
    
    // Register the auditor plugin for traffic capture
    auditor.registerPlugin(fastify)
  })

  afterAll(async () => {
    // Write captured traffic to named file for auditing
    await auditor.writeTraffic('route-schema-integration')
    
    // Clean up: drop the test table and close connections
    await pool.query('DROP TABLE IF EXISTS api.test_entities')
    await pool.end()
    await cleanupFastifyInstance(fastify)
  })

  beforeEach(async () => {
    // Seed test data before each test using fixture loader
    await fixtureLoader.loadAll(db)
  })

  afterEach(async () => {
    // Clear all fixtures using fixture loader
    await fixtureLoader.clearAll(db)
  })

  describe('SchemaBuilder GET routes', () => {
    it('should validate UUID param and return entity by ID', async () => {
      const testId = testEntity1.id
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/test-entities/${testId}`,
      })

      expect(response.statusCode).toBe(200)
      const entity = JSON.parse(response.body)
      expect(entity).toEqual(responses.entities.testEntity1)
    })

    it('should return all entities as array', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/test-entities',
      })

      expect(response.statusCode).toBe(200)
      const entities = JSON.parse(response.body)
      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBe(3) // From fixtures

      // Verify entities match expected response format
      expect(entities).toEqual(
        expect.arrayContaining([
          responses.entities.testEntity1,
          responses.entities.testEntity2,
          responses.entities.testEntity3,
        ])
      )
    })
  })

  describe('SchemaBuilder POST routes', () => {
    it('should validate request body and create entity', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test-entities',
        payload: requests.create.valid,
      })

      expect(response.statusCode).toBe(200)
      const created = JSON.parse(response.body)
      expect(created).toEqual(responses.created.fromValidRequest)
    })

    it('should return 400 for invalid request body', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test-entities',
        payload: requests.invalid.emptyName,
      })

      expect(response.statusCode).toBe(
        responses.errors.validationError.statusCode
      )
    })

    it('should handle optional fields correctly', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test-entities',
        payload: requests.create.minimal,
      })

      expect(response.statusCode).toBe(200)
      const created = JSON.parse(response.body)
      expect(created).toEqual(responses.created.fromMinimalRequest)
    })

    it('should handle entity with optional fields', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test-entities',
        payload: requests.create.withOptionalFields,
      })

      expect(response.statusCode).toBe(200)
      const created = JSON.parse(response.body)
      expect(created).toEqual(responses.created.fromOptionalFieldsRequest)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test-entities',
        payload: requests.invalid.missingName,
      })

      expect(response.statusCode).toBe(
        responses.errors.validationError.statusCode
      )
    })

    it('should return 400 for invalid field types', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test-entities',
        payload: requests.invalid.invalidType,
      })

      expect(response.statusCode).toBe(
        responses.errors.validationError.statusCode
      )
    })
  })

  describe('SchemaBuilder PUT routes', () => {
    it('should validate UUID param and request body for updates', async () => {
      const testId = testEntity2.id

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/test-entities/${testId}`,
        payload: requests.update.nameOnly,
      })

      expect(response.statusCode).toBe(200)
      const updated = JSON.parse(response.body)
      expect(updated).toEqual(responses.updated.nameOnlyUpdate)
    })

    it('should return 400 for invalid UUID in PUT request', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/test-entities/invalid-uuid',
        payload: requests.update.nameOnly,
      })

      expect(response.statusCode).toBe(responses.errors.invalidUuid.statusCode)
    })

    it('should handle partial updates correctly', async () => {
      const testId = testEntity3.id

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/test-entities/${testId}`,
        payload: requests.update.setInactive,
      })

      expect(response.statusCode).toBe(200)
      const updated = JSON.parse(response.body)
      expect(updated).toEqual({
        ...responses.entities.testEntity3,
        isActive: false,
        updatedAt: expect.any(String),
      })
    })

    it('should handle full updates correctly', async () => {
      const testId = testEntity3.id

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/test-entities/${testId}`,
        payload: requests.update.fullUpdate,
      })

      expect(response.statusCode).toBe(200)
      const updated = JSON.parse(response.body)
      expect(updated).toEqual(responses.updated.fullUpdate)
    })

    it('should return 404 for non-existent entity in PUT request', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999'

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/test-entities/${nonExistentId}`,
        payload: requests.update.nameOnly,
      })

      expect(response.statusCode).toBe(responses.errors.notFound.statusCode)
      const result = JSON.parse(response.body)
      expect(result.message).toBe(responses.errors.notFound.message)
    })
  })

  describe('SchemaBuilder DELETE routes', () => {
    it('should validate UUID param for delete requests', async () => {
      const testId = testEntity1.id

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/test-entities/${testId}`,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.body)
      expect(result.id).toBe(testId)
      expect(result.deleted).toBe(true)

      // Verify the entity was actually deleted by checking it's no longer in getAll
      const getAllResponse = await fastify.inject({
        method: 'GET',
        url: '/api/test-entities',
      })
      expect(getAllResponse.statusCode).toBe(200)
      const entities = JSON.parse(getAllResponse.body)
      const deletedEntity = entities.find(
        (e: { id: string }) => e.id === testId
      )
      expect(deletedEntity).toBeUndefined()
    })

    it('should return 400 for invalid UUID in DELETE request', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/test-entities/invalid-uuid',
      })

      expect(response.statusCode).toBe(responses.errors.invalidUuid.statusCode)
    })

    it('should return 404 for non-existent entity in DELETE request', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999'

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/test-entities/${nonExistentId}`,
      })

      expect(response.statusCode).toBe(responses.errors.notFound.statusCode)
      const result = JSON.parse(response.body)
      expect(result.message).toBe(responses.errors.notFound.message)
    })
  })

  describe('SchemaBuilder response validation', () => {
    it('should return 404 for non-existent entity', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999'

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/test-entities/${nonExistentId}`,
      })

      expect(response.statusCode).toBe(responses.errors.notFound.statusCode)
      const result = JSON.parse(response.body)
      expect(result.message).toBe(responses.errors.notFound.message)
    })

    it('should validate array response schema for getAll', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/test-entities',
      })

      expect(response.statusCode).toBe(200)
      const entities = JSON.parse(response.body)
      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBe(3) // From fixtures

      // Validate entities match expected response format exactly
      expect(entities).toEqual(
        expect.arrayContaining([
          responses.entities.testEntity1,
          responses.entities.testEntity2,
          responses.entities.testEntity3,
        ])
      )
    })
  })
})
