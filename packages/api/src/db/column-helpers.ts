import { timestamp } from 'drizzle-orm/pg-core'

export const timestamps = () => {
  return {
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
}
