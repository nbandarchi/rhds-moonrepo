import { createDbClient as createDbClientImpl } from '@rhds/api'
import { schema } from './schema'

export const createDbClient = () => {
  return createDbClientImpl({ schema })
}

export type { Schema } from './schema'
