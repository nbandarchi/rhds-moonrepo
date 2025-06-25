import { BaseRepository } from '@rhds/api'
import type { Schema } from '../../db/schema'
import { users } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export class UserRepository extends BaseRepository<typeof users, Schema> {
  constructor(db: NodePgDatabase<Schema>) {
    super(db, users)
  }
}
