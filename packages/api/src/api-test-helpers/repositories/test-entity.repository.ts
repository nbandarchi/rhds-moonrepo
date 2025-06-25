import { BaseRepository } from '../../core/base-repository'
import { testEntities } from '../schemas/test-entity.schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type TestEntitySchema = { testEntities: typeof testEntities }

export class TestEntityRepository extends BaseRepository<
  typeof testEntities,
  TestEntitySchema
> {
  constructor(db: NodePgDatabase<TestEntitySchema>) {
    super(db, testEntities)
  }
}
