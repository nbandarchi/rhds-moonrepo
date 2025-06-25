import type { PgColumn } from 'drizzle-orm/pg-core'
import { type ColumnBaseConfig, eq } from 'drizzle-orm'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type SelectModel<T extends AnyPgTable> = T['$inferSelect']
type InsertModel<T extends AnyPgTable> = T['$inferInsert']
type UpdateModel<T extends AnyPgTable> = Partial<T['$inferInsert']>

type FixtureTable = AnyPgTable & {
  id: PgColumn<ColumnBaseConfig<'string', 'PgUUID'>>
}

export abstract class BaseRepository<
  T extends FixtureTable,
  TSchema extends Record<string, FixtureTable>,
> {
  // protected selectSchema: BuildSchema<'select', T['_']['columns'], undefined>
  // protected createSchema: BuildSchema<'insert', T['_']['columns'], undefined>
  // protected updateSchema: ZodType

  constructor(
    protected db: NodePgDatabase<TSchema>,
    protected table: T
  ) {
    // this.selectSchema = createSelectSchema(this.table)
    // this.createSchema = createInsertSchema(this.table)
    // this.updateSchema = this.createSchema.partial()
  }

  public async getAll(): Promise<SelectModel<T>[]> {
    return this.db.select().from(this.table as AnyPgTable)
  }

  public async getById(id: string): Promise<SelectModel<T> | null> {
    const [row] = await this.db
      .select()
      .from(this.table as AnyPgTable)
      .where(eq(this.table.id, id))
      .limit(1)

    return row || null
  }

  public async create(data: InsertModel<T>): Promise<SelectModel<T>> {
    const [inserted] = await this.db.insert(this.table).values(data).returning()
    return inserted
  }

  public async update(
    id: string,
    data: UpdateModel<T>
  ): Promise<SelectModel<T> | null> {
    const [updated] = (await this.db
      .update(this.table)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(this.table.id, id))
      .returning()) as SelectModel<T>[]
    return updated || null
  }

  public async delete(id: string): Promise<{ id: string; deleted: boolean }> {
    const result = await this.db.delete(this.table).where(eq(this.table.id, id))
    const deleted = (result?.rowCount ?? 0) > 0
    return { id, deleted }
  }
}
