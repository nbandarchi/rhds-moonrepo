import { inArray, gte, or, type ColumnBaseConfig } from 'drizzle-orm'
import type { AnyPgTable, PgColumn } from 'drizzle-orm/pg-core'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type SelectModel<T extends AnyPgTable> = T['$inferSelect']

export type FixtureTable = AnyPgTable & {
  id: PgColumn<ColumnBaseConfig<'string', 'PgUUID'>>
  createdAt?: PgColumn<ColumnBaseConfig<'date', 'PgTimestamp'>>
}

export abstract class BaseFixture<
  T extends FixtureTable,
  TSchema extends Record<string, AnyPgTable>,
> {
  /**
   * Timestamp when this fixture instance was created or when seedRecords was last called.
   * Used to clean up records created during test runs.
   */
  private testStartTime: Date

  constructor() {
    this.testStartTime = new Date()
  }

  /**
   * Seeds the fixture data into the database and updates the test start time.
   */
  public async seedRecords(db: NodePgDatabase<TSchema>) {
    this.testStartTime = new Date()
    return await db.insert(this.schema).values(Object.values(this.data))
  }

  /**
   * Clears fixture records and any records created after the test started.
   * This handles both seeded fixture data and dynamically created test records.
   */
  public async clearRecords(db: NodePgDatabase<TSchema>) {
    const knownIds = Object.values(this.data).map((d) => d.id)

    // Build the where condition to delete:
    // 1. Records with known fixture IDs
    // 2. Records created after the test started (if createdAt column exists)
    const conditions = [inArray(this.schema.id, knownIds)]

    // If the table has a createdAt column, also delete records created during the test
    if (this.schema.createdAt) {
      conditions.push(gte(this.schema.createdAt, this.testStartTime))
    }

    await db.delete(this.schema).where(or(...conditions))
  }

  /**
   * Updates the test start time. Useful for marking a new test phase
   * without re-seeding data.
   */
  public markTestStart(): void {
    this.testStartTime = new Date()
  }

  /**
   * Gets the current test start time for reference.
   */
  public getTestStartTime(): Date {
    return this.testStartTime
  }

  public abstract schema: T
  public abstract data: Record<string, SelectModel<T>>
}
