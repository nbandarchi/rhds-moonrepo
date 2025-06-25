import { describe, it, expect } from 'vitest'
import { FixtureLoader } from './fixture-loader'
import { TestEntityFixture } from '../api-test-helpers/fixtures/test-entity.fixture'

describe('FixtureLoader', () => {
  it('should throw an error if fixture is not found', () => {
    const fixtureLoader = new FixtureLoader()
    expect(() => fixtureLoader.getFixture(TestEntityFixture)).toThrow()
  })
})
