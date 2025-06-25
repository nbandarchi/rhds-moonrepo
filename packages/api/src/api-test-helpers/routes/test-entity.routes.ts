import type { FastifyInstance } from 'fastify'
import { createRouteRegistry } from '../../core/route-registry'
import { NotFoundError } from '../../errors'
import { TestEntityRouteSchemas as schema } from '../schemas/test-entity.schema'

export function registerTestEntityRoutes(fastify: FastifyInstance) {
  const routes = createRouteRegistry(fastify, '/api/test-entities')

  routes.get('/:id', schema.getById, async ({ params, repositories, reply }) => {
    const entity = await repositories.testEntityRepository.getById(params.id)
    if (!entity) {
      throw new NotFoundError('Entity not found')
    }
    return entity
  })

  routes.get('/', schema.getAll, async ({ repositories }) => {
    return repositories.testEntityRepository.getAll()
  })

  routes.post('/', schema.post, async ({ body, repositories }) => {
    return repositories.testEntityRepository.create(body)
  })

  routes.put('/:id', schema.update, async ({ params, body, repositories }) => {
    const updated = await repositories.testEntityRepository.update(params.id, body)
    if (!updated) {
      throw new NotFoundError('Entity not found')
    }
    return updated
  })

  routes.delete('/:id', schema.delete, async ({ params, repositories }) => {
    const result = await repositories.testEntityRepository.delete(params.id)
    if (!result.deleted) {
      throw new NotFoundError('Entity not found')
    }
    return result
  })
}
