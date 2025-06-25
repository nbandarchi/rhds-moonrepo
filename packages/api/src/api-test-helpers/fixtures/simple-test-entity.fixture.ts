import { BaseFixture } from '../../core/base-fixture'
import {
  simpleTestEntities,
  type SimpleTestEntity,
} from '../schemas/simple-test-entity.schema'

export class SimpleTestEntityFixture extends BaseFixture<
  typeof simpleTestEntities,
  { simpleTestEntities: typeof simpleTestEntities }
> {
  public schema = simpleTestEntities

  public data: Record<string, SimpleTestEntity> = {
    simple1: {
      id: '123e4567-e89b-12d3-a456-426614174101',
      name: 'Simple Test Entity One',
      description: 'First simple entity without timestamps',
      isActive: true,
    },
    simple2: {
      id: '123e4567-e89b-12d3-a456-426614174102',
      name: 'Simple Test Entity Two',
      description: 'Second simple entity without timestamps',
      isActive: false,
    },
  }
}
