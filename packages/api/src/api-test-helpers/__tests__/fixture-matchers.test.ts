import { describe, it, expect } from 'vitest'
import { TestEntityFixture } from '../fixtures/test-entity.fixture'

describe('Fixture Matchers Demo', () => {
  const fixture = new TestEntityFixture()

  it('should use expect.any() matchers for generated fields in created responses', () => {
    // Simulate a created entity response from the API
    const createdEntity = {
      id: '550e8400-e29b-41d4-a716-446655440000', // Generated UUID
      name: 'New Test Entity',
      description: 'Created via API',
      isActive: true,
      createdAt: '2024-06-09T15:30:45.123Z', // Generated timestamp
      updatedAt: '2024-06-09T15:30:45.123Z', // Generated timestamp
    }

    // This should work with expect.any() matchers
    expect(createdEntity).toEqual(fixture.responses.created.fromValidRequest)
  })

  it('should use expect.any() for updatedAt in update responses', () => {
    // Simulate an updated entity response from the API
    const updatedEntity = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      name: 'Updated Name',
      description: 'Second test entity for integration testing',
      isActive: false,
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-06-09T15:35:20.456Z', // New timestamp
    }

    // This should work with expect.any() matcher for updatedAt
    expect(updatedEntity).toEqual(fixture.responses.updated.nameOnlyUpdate)
  })

  it('should provide typed request fixtures for different scenarios', () => {
    // Valid create request
    expect(fixture.requests.create.valid).toEqual({
      name: 'New Test Entity',
      description: 'Created via API',
      isActive: true,
    })

    // Minimal create request (only required fields)
    expect(fixture.requests.create.minimal).toEqual({
      name: 'Minimal Entity',
    })

    // Invalid request (for validation testing)
    expect(fixture.requests.invalid.emptyName).toEqual({
      name: '',
      description: 'Invalid: empty name',
    })
  })

  it('should provide error response fixtures', () => {
    expect(fixture.responses.errors.notFound).toEqual({
      statusCode: 404,
      message: 'Entity not found',
    })

    expect(fixture.responses.errors.validationError).toEqual({
      statusCode: 400,
    })
  })
})