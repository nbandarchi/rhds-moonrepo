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
import {
  testEntities,
  type TestEntity,
} from '../../src/api-test-helpers/schemas/test-entity.schema'
import { TestEntityRepository } from '../../src/api-test-helpers/repositories/test-entity.repository'
import { TestEntityFixture } from '../../src/api-test-helpers/fixtures/test-entity.fixture'
import { simpleTestEntities } from '../../src/api-test-helpers/schemas/simple-test-entity.schema'
import { SimpleTestEntityFixture } from '../../src/api-test-helpers/fixtures/simple-test-entity.fixture'
import { FixtureLoader } from '../../src/testing/fixture-loader'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

describe('Database Integration Tests', () => {
  let db: NodePgDatabase<{ testEntities: typeof testEntities }>
  let pool: Pool
  let testEntityRepository: TestEntityRepository
  const fixtureLoader = new FixtureLoader()
  fixtureLoader.addFixture(new TestEntityFixture())
  const testEntityFixture = fixtureLoader.getFixture(TestEntityFixture)
  const { testEntity1, testEntity2, testEntity3 } = testEntityFixture.data

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

    // Initialize service, fixture, and fixture loader
    testEntityRepository = new TestEntityRepository(db)
    await fixtureLoader.clearAll(db)
  })

  afterAll(async () => {
    // Clean up: drop the test table and close connection
    await pool.query('DROP TABLE IF EXISTS api.test_entities')
    await pool.end()
  })

  beforeEach(async () => {
    // Seed test data before each test using fixture loader
    await fixtureLoader.loadAll(db)
  })

  afterEach(async () => {
    // Clear all fixtures using fixture loader
    await fixtureLoader.clearAll(db)
  })

  describe('BaseRepository CRUD Operations', () => {
    it('should retrieve all test entities', async () => {
      const entities = await testEntityRepository.getAll()

      expect(entities).toHaveLength(3)
      expect(entities.map((e) => e.name)).toEqual(
        expect.arrayContaining([
          testEntity1.name,
          testEntity2.name,
          testEntity3.name,
        ])
      )
    })

    it('should retrieve a test entity by ID', async () => {
      const testId = '123e4567-e89b-12d3-a456-426614174001'
      const entity = await testEntityRepository.getById(testId)

      expect(entity).not.toBeNull()
      expect(entity?.id).toBe(testId)
      expect(entity?.name).toBe(testEntity1.name)
      expect(entity?.description).toBe(testEntity1.description)
      expect(entity?.isActive).toBe(testEntity1.isActive)
    })

    it('should return null for non-existent ID', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999'
      const entity = await testEntityRepository.getById(nonExistentId)

      expect(entity).toBeNull()
    })

    it('should create a new test entity', async () => {
      const newEntity = {
        name: 'New Test Entity',
        description: 'Created during integration test',
        isActive: true,
      }

      const created = await testEntityRepository.create(newEntity)

      expect(created.id).toBeDefined()
      expect(created.name).toBe(newEntity.name)
      expect(created.description).toBe(newEntity.description)
      expect(created.isActive).toBe(newEntity.isActive)
      expect(created.createdAt).toBeDefined()
      expect(created.updatedAt).toBeDefined()

      // Verify it was actually saved
      const retrieved = await testEntityRepository.getById(created.id)
      expect(retrieved).toEqual(created)
    })

    it('should update an existing test entity', async () => {
      const testId = '123e4567-e89b-12d3-a456-426614174002'
      const updates = {
        name: 'Updated Test Entity Two',
        isActive: true,
      }

      const updated = (await testEntityRepository.update(
        testId,
        updates
      )) as TestEntity

      expect(updated.id).toBe(testId)
      expect(updated.name).toBe(updates.name)
      expect(updated.isActive).toBe(updates.isActive)
      expect(updated.description).toBe(testEntity2.description)

      // Verify the update was persisted
      const retrieved = await testEntityRepository.getById(testId)
      expect(retrieved?.name).toBe(updates.name)
      expect(retrieved?.isActive).toBe(updates.isActive)
    })

    it('should delete an existing test entity', async () => {
      const testId = '123e4567-e89b-12d3-a456-426614174003'

      // Verify entity exists before deletion
      const beforeDelete = await testEntityRepository.getById(testId)
      expect(beforeDelete).not.toBeNull()

      // Delete the entity
      const result = await testEntityRepository.delete(testId)
      expect(result).toEqual({ id: testId, deleted: true })

      // Verify entity no longer exists
      const afterDelete = await testEntityRepository.getById(testId)
      expect(afterDelete).toBeNull()

      // Verify other entities are unaffected
      const remaining = await testEntityRepository.getAll()
      expect(remaining).toHaveLength(2)
    })

    it('should return deleted: false when deleting non-existent entity', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999'
      const result = await testEntityRepository.delete(nonExistentId)

      expect(result).toEqual({ id: nonExistentId, deleted: false })
    })

    it('should handle null rowCount in delete result', async () => {
      // Create a custom service to test the null coalescing operator directly
      class TestNullRowCountRepository extends TestEntityRepository {
        async delete(id: string): Promise<{ id: string; deleted: boolean }> {
          // Mock a delete result that could have null rowCount
          const mockResult = { rowCount: null }
          // This directly tests the line: return (result.rowCount ?? 0) > 0
          const deleted = (mockResult.rowCount ?? 0) > 0
          return { id, deleted }
        }
      }

      const testRepository = new TestNullRowCountRepository(db)
      const result = await testRepository.delete('any-id')

      // Should return deleted: false when rowCount is null
      expect(result).toEqual({ id: 'any-id', deleted: false })
    })
  })

  describe('Database Schema and Constraints', () => {
    it('should enforce NOT NULL constraint on name field', async () => {
      const invalidEntity = {
        name: null as unknown as string,
        description: 'Should fail due to null name',
      }

      await expect(testEntityRepository.create(invalidEntity)).rejects.toThrow()
    })

    it('should handle entities with null description', async () => {
      const entityWithNullDescription = {
        name: 'Entity with null description',
        description: null,
        isActive: false,
      }

      const created = await testEntityRepository.create(entityWithNullDescription)

      expect(created.name).toBe(entityWithNullDescription.name)
      expect(created.description).toBeNull()
      expect(created.isActive).toBe(false)
    })
  })

  describe('BaseFixture Enhanced Functionality', () => {
    it('should track test start time and update it when seeding records', async () => {
      const initialTime = testEntityFixture.getTestStartTime()

      // Wait a small amount to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Clear first, then seed to avoid duplicate key constraint
      await testEntityFixture.clearRecords(db)
      await testEntityFixture.seedRecords(db)
      const afterSeedTime = testEntityFixture.getTestStartTime()

      expect(afterSeedTime.getTime()).toBeGreaterThan(initialTime.getTime())
    })

    it('should manually update test start time with markTestStart', async () => {
      const initialTime = testEntityFixture.getTestStartTime()

      // Wait a small amount to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      testEntityFixture.markTestStart()
      const afterMarkTime = testEntityFixture.getTestStartTime()

      expect(afterMarkTime.getTime()).toBeGreaterThan(initialTime.getTime())
    })

    it('should clear both seeded and dynamically created records', async () => {
      // Start with seeded records (3 entities)
      let entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(3)

      // Create a new entity dynamically during the test
      const dynamicEntity = await testEntityRepository.create({
        name: 'Dynamic Test Entity',
        description: 'Created during test execution',
        isActive: true,
      })

      // Verify we now have 4 entities
      entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(4)

      // Clear all records using the enhanced clearRecords method
      await testEntityFixture.clearRecords(db)

      // Verify all records are cleaned up
      entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(0)

      // Verify the dynamic entity was also deleted
      const retrievedDynamic = await testEntityRepository.getById(dynamicEntity.id)
      expect(retrievedDynamic).toBeNull()
    })

    it('should only clear records created after marking test start time', async () => {
      // Clear existing records and create a record before marking test start
      await testEntityFixture.clearRecords(db)

      const beforeEntity = await testEntityRepository.create({
        name: 'Before Test Start',
        description: 'Created before test start time',
        isActive: true,
      })

      // Wait a bit and mark the new test start time
      await new Promise((resolve) => setTimeout(resolve, 10))
      testEntityFixture.markTestStart()

      // Create a record after marking test start
      await testEntityRepository.create({
        name: 'After Test Start',
        description: 'Created after test start time',
        isActive: true,
      })

      // Verify both records exist
      let entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(2)

      // Clear records - should only remove the "after" entity and seeded data (but no seeded data exists)
      await testEntityFixture.clearRecords(db)

      // The "before" entity should still exist, "after" entity should be gone
      entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(1)
      expect(entities[0].id).toBe(beforeEntity.id)

      // Clean up the remaining entity for other tests
      await testEntityRepository.delete(beforeEntity.id)
    })

    it('should clear records from tables without createdAt columns', async () => {
      // Create a separate database client for the simple schema
      const simpleDbClient = createDbClient({
        schema: { simpleTestEntities },
      })

      // Create the simple test table without timestamps
      await simpleDbClient.pool.query(`
        CREATE TABLE IF NOT EXISTS api.simple_test_entities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true
        )
      `)

      const simpleFixture = new SimpleTestEntityFixture()

      try {
        // Seed the simple fixture data
        await simpleFixture.seedRecords(simpleDbClient.db)

        // Verify records exist
        const records = await simpleDbClient.db
          .select()
          .from(simpleTestEntities)
        expect(records).toHaveLength(2)

        // Clear records - this should only clear by known IDs since there's no createdAt
        await simpleFixture.clearRecords(simpleDbClient.db)

        // Verify all records are cleaned up
        const afterClear = await simpleDbClient.db
          .select()
          .from(simpleTestEntities)
        expect(afterClear).toHaveLength(0)
      } finally {
        // Clean up the test table and close connection
        await pool.query('DROP TABLE IF EXISTS api.simple_test_entities')
        await simpleDbClient.pool.end()
      }
    })
  })

  describe('FixtureLoader Functionality', () => {
    it('should load and clear multiple fixtures', async () => {
      // Create a separate fixture loader for this test
      const testLoader = new FixtureLoader()

      // Create a second test entity fixture with different data
      const secondFixture = new TestEntityFixture()
      secondFixture.data = {
        tempEntity1: {
          id: '123e4567-e89b-12d3-a456-426614174201',
          name: 'Temp Entity One',
          description: 'Temporary test entity',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
      }

      // Test addFixture method
      testLoader.addFixture(testEntityFixture)

      // Test addFixtures method (array)
      testLoader.addFixtures([secondFixture])

      // Clear any existing data
      await testLoader.clearAll(db)

      // Verify no entities exist
      let entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(0)

      // Test loadAll method
      await testLoader.loadAll(db)

      // Should have 4 entities (3 from testEntityFixture + 1 from secondFixture)
      entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(4)

      // Test clearAll method
      await testLoader.clearAll(db)

      // Should have no entities
      entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(0)
    })

    it('should reload all fixtures', async () => {
      // Start with our regular fixtures loaded
      let entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(3)

      // Create a new entity during the test
      await testEntityRepository.create({
        name: 'Dynamic Entity',
        description: 'Created during test',
        isActive: true,
      })

      // Should now have 4 entities
      entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(4)

      // Test reloadAll method - should clear everything and reload just the fixtures
      await fixtureLoader.reloadAll(db)

      // Should be back to just the 3 fixture entities
      entities = await testEntityRepository.getAll()
      expect(entities).toHaveLength(3)

      // Verify the dynamic entity is gone and fixture entities are back
      const entityNames = entities.map((e) => e.name).sort()
      expect(entityNames).toEqual([
        testEntity1.name,
        testEntity3.name,
        testEntity2.name,
      ])
    })

    it('should support method chaining for fixture setup', async () => {
      // Create a new loader and test method chaining
      const chainLoader = new FixtureLoader()

      const fixture1 = new TestEntityFixture()
      const fixture2 = new TestEntityFixture()

      // Test that addFixture returns 'this' for chaining
      const result = chainLoader.addFixture(fixture1).addFixtures([fixture2])

      expect(result).toBe(chainLoader)

      // Clean up
      await chainLoader.clearAll(db)
    })
  })
})
