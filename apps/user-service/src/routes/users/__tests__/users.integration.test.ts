import { beforeAll, beforeEach, describe, expect, it, afterAll } from 'vitest'
import { createApp } from '../../../server'
import type { FastifyInstance } from 'fastify'
import { UserFixture } from '../users.fixture'
import { fixtures } from '../../../testing/fixtures'
import { auditor } from '../../../testing/auditor'

describe('Users Integration Tests', () => {
  let app: FastifyInstance
  const userFixture = fixtures.getFixture(UserFixture)
  const { testUser } = userFixture.data

  beforeAll(async () => {
    app = await createApp()
    auditor.registerPlugin(app)
  })

  beforeEach(async () => {
    await fixtures.reloadAll(app.db)
  })

  afterAll(async () => {
    await auditor.writeTraffic('user-service-integration')
    await fixtures.clearAll(app.db)
    await app.close()
  })

  describe('User Repository Tests', () => {
    it('should get a user by id', async () => {
      const userRepository = app.repositories.users
      const user = await userRepository.getById(testUser.id)
      expect(user).toEqual(testUser)
    })
  })

  describe('User Routes Tests', () => {
    describe('GET /users/:id', () => {
      it('should get a user by id', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/users/${testUser.id}`,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(userFixture.responses.entities.testUser)
      })

      it('should return 400 if an invalid UUID is provided', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/users/invalid-uuid',
        })
        expect(response.statusCode).toBe(400)
      })

      it('should return 404 if user not found', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/users/99999999-9999-9999-9999-999999999999',
        })
        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual(userFixture.responses.errors.notFound)
      })
    })

    describe('GET /users', () => {
      it('should get all users', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/users',
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual([
          userFixture.responses.entities.testUser,
        ])
      })
    })

    describe('POST /users', () => {
      it('should create a new user', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/users',
          payload: userFixture.requests.create.valid,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(
          userFixture.responses.created.fromValidRequest
        )
      })

      it('should return 400 for invalid request body', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/users',
          payload: userFixture.requests.invalid.missingRequired,
        })
        expect(response.statusCode).toBe(400)
      })
    })

    describe('PUT /users/:id', () => {
      it('should update a user', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/api/users/${testUser.id}`,
          payload: userFixture.requests.update.fullUpdate,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(
          userFixture.responses.updated.fullUpdate
        )
      })

      it('should partially update a user', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/api/users/${testUser.id}`,
          payload: userFixture.requests.update.nameOnly,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(
          userFixture.responses.updated.nameOnlyUpdate
        )
      })

      it('should return a 400 for an invalid request body', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/api/users/${testUser.id}`,
          payload: userFixture.requests.invalid.missingRequired,
        })
        expect(response.statusCode).toBe(400)
      })

      it('should return 404 if user not found', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/users/99999999-9999-9999-9999-999999999999',
          payload: userFixture.requests.update.nameOnly,
        })
        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual(userFixture.responses.errors.notFound)
      })
    })

    describe('DELETE /users/:id', () => {
      it('should delete a user', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: `/api/users/${testUser.id}`,
        })
        expect(response.statusCode).toBe(200)
      })

      it('should return 400 if an invalid UUID is provided', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/users/invalid-uuid',
        })
        expect(response.statusCode).toBe(400)
      })

      it('should return 404 if user not found', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/users/99999999-9999-9999-9999-999999999999',
        })
        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual(userFixture.responses.errors.notFound)
      })
    })
  })
})
