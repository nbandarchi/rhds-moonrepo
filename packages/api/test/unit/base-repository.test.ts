import { describe, it, expect, vi } from 'vitest'
import { BaseRepository } from '../../src/core/base-repository'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

// Create a test table schema
const testTable = pgTable('test_table', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

class TestRepository extends BaseRepository<
  typeof testTable,
  { testTable: typeof testTable }
> {
  constructor(db: NodePgDatabase<{ testTable: typeof testTable }>) {
    super(db, testTable)
  }
}

describe('BaseRepository', () => {
  const mock = vi.fn()
  const mockDb = {
    delete: vi.fn().mockReturnValue({
      where: mock,
    }),
  }
  const testRepository = new TestRepository(
    mockDb as unknown as NodePgDatabase<{ testTable: typeof testTable }>
  )
  describe('delete method', () => {
    it('should handle null rowCount in delete result', async () => {
      mock.mockResolvedValue({ rowCount: null })

      const result = await testRepository.delete('test-id')

      expect(result).toEqual({ id: 'test-id', deleted: false })
      expect(mockDb.delete).toHaveBeenCalledWith(testTable)
    })

    it('should handle zero rowCount in delete result', async () => {
      mock.mockResolvedValue({ rowCount: 0 })

      const result = await testRepository.delete('test-id')

      expect(result).toEqual({ id: 'test-id', deleted: false })
      expect(mockDb.delete).toHaveBeenCalledWith(testTable)
    })

    it('should return deleted: true when rowCount is greater than 0', async () => {
      mock.mockResolvedValue({ rowCount: 1 })

      const result = await testRepository.delete('test-id')

      expect(result).toEqual({ id: 'test-id', deleted: true })
      expect(mockDb.delete).toHaveBeenCalledWith(testTable)
    })
  })
})
