import { describe, beforeAll, afterAll, it, expect } from 'vitest'
import { createApp } from '../server'
import type { FastifyInstance } from 'fastify'

describe('Server Tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createApp()
    app.get('/generic-error', async () => {
      throw new Error('Generic Error')
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('should handle unexpected errors gracefully  ', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/generic-error',
    })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: true,
      message: 'Generic Error',
      statusCode: 500,
    })
  })
})
