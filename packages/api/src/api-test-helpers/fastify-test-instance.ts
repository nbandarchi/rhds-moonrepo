import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'
import Swagger from '@fastify/swagger'
import SwaggerUi from '@fastify/swagger-ui'
import { TestEntityRepository } from './repositories/test-entity.repository'
import { createDbClient } from '../db/client'
import { testEntities } from './schemas/test-entity.schema'

type Repositories = {
  testEntityRepository: TestEntityRepository
}

declare module 'fastify' {
  interface FastifyInstance {
    repositories: Repositories
  }
}

/**
 * Creates a test Fastify instance with a test database and services.
 */
export async function createTestFastifyInstance(
  opts: { plugins?: FastifyPluginAsync[] } = {}
): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false })

  const schema = { testEntities }
  const { db } = createDbClient({ schema })

  const repositories = {
    testEntityRepository: new TestEntityRepository(db),
  }

  fastify.decorate('db', db)
  fastify.decorate('repositories', repositories)

  // Register Swagger/OpenAPI documentation plugins. These collect all routes
  // that have JSON schemas attached (added via `createRouteRegistry`) and
  // expose the generated OpenAPI spec at `/docs`.
  await fastify.register(Swagger, {
    openapi: {
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    },
  })

  await fastify.register(SwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  })

  return fastify
}

export async function cleanupFastifyInstance(
  fastify: FastifyInstance
): Promise<void> {
  await fastify.close()
}
