import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { createRouteRegistry } from '../route-registry'
import {
  createTestFastifyInstance,
  cleanupFastifyInstance,
} from '../../api-test-helpers/fastify-test-instance'

describe('Route Registry', () => {
  let fastify: FastifyInstance

  beforeEach(async () => {
    fastify = await createTestFastifyInstance()
  })

  afterEach(async () => {
    await cleanupFastifyInstance(fastify)
  })

  describe('GET routes', () => {
    it('should register a simple GET route', async () => {
      const routes = createRouteRegistry(fastify)

      routes.get('/test', {}, async () => {
        return { message: 'test' }
      })

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ message: 'test' })
    })

    it('should register a GET route with path parameters', async () => {
      const routes = createRouteRegistry(fastify)

      const ParamsSchema = z.object({
        id: z.string().uuid(),
      })

      routes.get(
        '/users/:id',
        {
          params: ParamsSchema,
        },
        async ({ params }) => {
          return { userId: params.id }
        }
      )

      const testId = '123e4567-e89b-12d3-a456-426614174000'
      const response = await fastify.inject({
        method: 'GET',
        url: `/users/${testId}`,
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ userId: testId })
    })

    it('should register a GET route with query parameters', async () => {
      const routes = createRouteRegistry(fastify)

      const QuerySchema = z.object({
        limit: z.string().optional(),
        offset: z.string().optional(),
      })

      routes.get(
        '/users',
        {
          querystring: QuerySchema,
        },
        async ({ query }) => {
          return {
            limit: query?.limit || '10',
            offset: query?.offset || '0',
          }
        }
      )

      const response = await fastify.inject({
        method: 'GET',
        url: '/users?limit=5&offset=10',
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({
        limit: '5',
        offset: '10',
      })
    })
  })

  describe('POST routes', () => {
    it('should register a POST route with body validation', async () => {
      const routes = createRouteRegistry(fastify)

      const BodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
      })

      routes.post(
        '/users',
        {
          body: BodySchema,
        },
        async ({ body }) => {
          return {
            id: '123',
            name: body.name,
            email: body.email,
          }
        }
      )

      const response = await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      })
    })

    it('should validate request body and return 400 for invalid data', async () => {
      const routes = createRouteRegistry(fastify)

      const BodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
      })

      routes.post(
        '/users',
        {
          body: BodySchema,
        },
        async ({ body }) => {
          return { name: body.name, email: body.email }
        }
      )

      const response = await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'John Doe',
          email: 'invalid-email',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('Route prefix', () => {
    it('should register routes with a prefix', async () => {
      const routes = createRouteRegistry(fastify, '/api/v1')

      routes.get('/users', {}, async () => {
        return { message: 'users endpoint' }
      })

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/users',
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({
        message: 'users endpoint',
      })
    })
  })

  describe('Response schemas', () => {
    it('should handle response schemas', async () => {
      const routes = createRouteRegistry(fastify)

      const ResponseSchema = z.object({
        id: z.string(),
        name: z.string(),
      })

      routes.get(
        '/users/1',
        {
          response: {
            200: ResponseSchema,
          },
        },
        async () => {
          return { id: '1', name: 'John Doe' }
        }
      )

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/1',
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({
        id: '1',
        name: 'John Doe',
      })
    })
  })
})
