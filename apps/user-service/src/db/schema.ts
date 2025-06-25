import { users } from '../routes/users/users.schema'

export const schema = {
  users,
}

export type Schema = typeof schema

// Re-export everything for drizzle-kit
export * from '../routes/users/users.schema'
