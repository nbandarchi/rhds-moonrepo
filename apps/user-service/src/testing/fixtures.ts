import { UserFixture } from '../routes/users/users.fixture'
import { FixtureLoader } from '@rhds/api'

export const fixtures = new FixtureLoader()
fixtures.addFixture(new UserFixture())
