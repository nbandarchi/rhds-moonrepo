import { pgTable, text, uuid, boolean } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { SchemaBuilder } from '../../core/schema-builder'
import { timestamps } from '../../db/column-helpers'

export const testEntities = pgTable('test_entities', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  ...timestamps(),
})

export type TestEntity = typeof testEntities.$inferSelect
export type NewTestEntity = typeof testEntities.$inferInsert

// API response type (matches the Zod schema with string timestamps)
export type TestEntityApiResponse = z.infer<typeof TestEntitySelectSchema>

// Manual Zod schemas for API validation (separate from DB schemas)
// Select schema - includes all fields for now
export const TestEntitySelectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// Create schema - no timestamps allowed, require non-empty name
export const TestEntityCreateSchema = z.object({
  name: z.string().min(1, 'Name must not be empty'),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

// Update schema - no ID or timestamps allowed, require non-empty name if provided
export const TestEntityUpdateSchema = z.object({
  name: z.string().min(1, 'Name must not be empty').optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

// Schema builder schemas for routes
export const TestEntityRouteSchemas = {
  getById: SchemaBuilder.getById(TestEntitySelectSchema),
  getAll: SchemaBuilder.getAll(TestEntitySelectSchema),
  post: SchemaBuilder.post(TestEntitySelectSchema, TestEntityCreateSchema),
  update: SchemaBuilder.update(TestEntitySelectSchema, TestEntityUpdateSchema),
  delete: SchemaBuilder.delete(),
}
