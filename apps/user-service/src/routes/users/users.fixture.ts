import { BaseFixture } from '@rhds/api'
import type { Schema } from '../../db/schema'
import { users } from '../../db/schema'
import type { User } from '../../routes/users/users.schema'
import { expect } from 'vitest'

export class UserFixture extends BaseFixture<typeof users, Schema> {
  public schema = users

  static ids = {
    testUser: '123e4567-e89b-12d3-a456-426614174001',
  }

  data: Record<string, User> = {
    testUser: {
      id: UserFixture.ids.testUser,
      authId: 'auth0|1234567890',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      meta: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
  }

  public requests = {
    create: {
      valid: {
        authId: 'auth0|9876543210',
        email: 'test2@example.com',
        firstName: 'Test',
        lastName: 'User',
        meta: { test: 'test' },
      },
    },
    update: {
      nameOnly: {
        firstName: 'Test',
        lastName: 'User',
      },
      fullUpdate: {
        firstName: 'Test',
        lastName: 'User',
        meta: { test: 'test' },
      },
    },
    invalid: {
      missingRequired: {
        authId: '',
        email: '',
        firstName: '',
        lastName: '',
      },
    },
  }

  public responses = {
    entities: {
      testUser: {
        ...this.data.testUser,
        createdAt: this.data.testUser.createdAt.toISOString(),
        updatedAt: this.data.testUser.updatedAt.toISOString(),
      },
    },
    created: {
      fromValidRequest: {
        ...this.requests.create.valid,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    },
    updated: {
      nameOnlyUpdate: {
        ...this.data.testUser,
        firstName: this.requests.update.nameOnly.firstName,
        lastName: this.requests.update.nameOnly.lastName,
        createdAt: this.data.testUser.createdAt.toISOString(),
        updatedAt: expect.any(String),
      },
      fullUpdate: {
        ...this.data.testUser,
        firstName: this.requests.update.fullUpdate.firstName,
        lastName: this.requests.update.fullUpdate.lastName,
        meta: this.requests.update.fullUpdate.meta,
        createdAt: this.data.testUser.createdAt.toISOString(),
        updatedAt: expect.any(String),
      },
    },
    errors: {
      notFound: {
        message: 'User not found',
      },
    },
  }
}
