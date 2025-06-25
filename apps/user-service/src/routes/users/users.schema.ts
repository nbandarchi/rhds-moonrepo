import { json, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamps } from '@rhds/api'
import { z } from 'zod'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  authId: text('auth_id').notNull().unique(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  meta: json('meta').notNull(),
  ...timestamps(),
})

export type User = typeof users.$inferSelect
export type InsertUser = typeof users.$inferInsert
export type UpdateUser = Partial<
  Omit<User, 'id' | 'authId' | 'createdAt' | 'updatedAt'>
>

export const UserResponse = z.object({
  id: z.string(),
  authId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  meta: z.record(z.string(), z.any()),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const CreateUserRequest = z.object({
  authId: z.string().min(1, 'Auth ID is required'),
  email: z.string().email('Invalid email'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  meta: z.record(z.string(), z.any()).default({}),
})

export const UpdateUserRequest = CreateUserRequest.partial().omit({
  authId: true,
  email: true,
})

export type UserResponse = z.infer<typeof UserResponse>
export type CreateUserRequest = z.infer<typeof CreateUserRequest>
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>
