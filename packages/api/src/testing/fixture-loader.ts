import type { BaseFixture, FixtureTable } from '../core/base-fixture'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

// define class constructor type
type ClassConstructor<T> = new (...args: unknown[]) => T

export class FixtureLoader<
  T extends FixtureTable,
  TSchema extends Record<string, T>,
> {
  private fixtures: BaseFixture<T, TSchema>[] = []

  getFixture<TFixture>(fixture: ClassConstructor<TFixture>): TFixture {
    const result = this.fixtures.find((obj) => obj instanceof fixture)
    if (!result) {
      throw new Error(`Fixture ${fixture.name} not found`)
    }
    return result as TFixture
  }

  addFixture(fixture: BaseFixture<T, TSchema>): this {
    this.fixtures.push(fixture)
    return this
  }

  addFixtures(fixtures: BaseFixture<T, TSchema>[]): this {
    this.fixtures.push(...fixtures)
    return this
  }

  async loadAll(db: NodePgDatabase<TSchema>): Promise<void> {
    for (const fixture of this.fixtures) {
      await fixture.seedRecords(db)
    }
  }

  async clearAll(db: NodePgDatabase<TSchema>): Promise<void> {
    for (let i = this.fixtures.length - 1; i >= 0; i--) {
      await this.fixtures[i].clearRecords(db)
    }
  }

  async reloadAll(db: NodePgDatabase<TSchema>): Promise<void> {
    await this.clearAll(db)
    await this.loadAll(db)
  }
}
