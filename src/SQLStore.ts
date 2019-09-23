import sqlite from 'sqlite'
import { SQLStatement } from 'sql-template-strings'

export { default as SQL } from 'sql-template-strings'

export default class SQLStore {
  private dbPromise: Promise<sqlite.Database>

  constructor(storage: string) {
    this.dbPromise = Promise.resolve()
      .then(() => sqlite.open(storage))
      .then((db) => db.migrate({ force: 'last' }))
  }

  async get(sql: SQLStatement) {
    const db = await this.dbPromise
    return db.get(sql)
  }

  async run(sql: SQLStatement) {
    const db = await this.dbPromise
    return db.run(sql)
  }

  async all(sql: SQLStatement) {
    const db = await this.dbPromise
    return db.all(sql)
  }
}

// Join multiple statements with a delimiter.
export function joinStatements(statements: SQLStatement[], delimiter: string) {
  return statements.reduce((stmt, curr) => stmt.append(delimiter).append(curr))
}
