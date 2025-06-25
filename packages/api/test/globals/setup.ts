import { auditor } from '../setup/auditor'
import { createTestFastifyInstance } from '../../src/api-test-helpers/fastify-test-instance'
import { registerTestEntityRoutes } from '../../src/api-test-helpers/routes/test-entity.routes'

// App factory for the API package tests
async function createTestApp() {
  const fastify = await createTestFastifyInstance()
  registerTestEntityRoutes(fastify)
  return fastify
}

// Vitest will execute the default-exported async function once before any tests run.
export default async function globalSetup() {
  return auditor.setup(createTestApp)
}
