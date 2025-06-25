import { pgTable, text, uuid, boolean } from 'drizzle-orm/pg-core'

export const simpleTestEntities = pgTable('simple_test_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  // Note: No createdAt or updatedAt columns
})

export type SimpleTestEntity = typeof simpleTestEntities.$inferSelect
export type NewSimpleTestEntity = typeof simpleTestEntities.$inferInsert