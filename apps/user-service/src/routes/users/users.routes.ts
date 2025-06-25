import type { FastifyInstance } from 'fastify'
import { createRouteRegistry, SchemaBuilder, NotFoundError } from '@rhds/api'
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from './users.schema'

export function registerUserRoutes(fastify: FastifyInstance) {
  const routes = createRouteRegistry(fastify, '/api/users')

  routes.get(
    '/:id',
    SchemaBuilder.getById(UserResponse),
    async ({ params }) => {
      const user = await fastify.repositories.users.getById(params.id)
      if (!user) {
        throw new NotFoundError('User not found')
      }
      return user
    }
  )

  routes.get('/', SchemaBuilder.getAll(UserResponse), async () => {
    return fastify.repositories.users.getAll()
  })

  routes.post(
    '/',
    SchemaBuilder.post(UserResponse, CreateUserRequest),
    async ({ body }) => {
      const user = await fastify.repositories.users.create(body)
      return user
    }
  )

  routes.put(
    '/:id',
    SchemaBuilder.update(UserResponse, UpdateUserRequest),
    async ({ params, body }) => {
      const user = await fastify.repositories.users.update(params.id, body)
      if (!user) {
        throw new NotFoundError('User not found')
      }
      return user
    }
  )

  routes.delete('/:id', SchemaBuilder.delete(), async ({ params }) => {
    const result = await fastify.repositories.users.delete(params.id)
    if (!result.deleted) {
      throw new NotFoundError('User not found')
    }
    return result
  })
}
