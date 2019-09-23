import sqlite from 'sqlite'
import { SQLStatement } from 'sql-template-strings'
import path from 'path'

export { default as SQL } from 'sql-template-strings'

// Migration path will default to the INIT_CWD/migrations, which will
// not be what we want when using hypermerge as a dependency of another
// project.
const migrationsPath = path.resolve(__dirname, '../migrations')

export default class SQLStore {
  private dbPromise: Promise<sqlite.Database>

  constructor(storage: string) {
    this.dbPromise = Promise.resolve()
      .then(() => sqlite.open(storage))
      .then((db) => db.migrate({ force: 'last', migrationsPath }))
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

  async close() {
    const db = await this.dbPromise
    db.close()
  }
}

// Join multiple statements with a delimiter.
export function joinStatements(statements: SQLStatement[], delimiter: string) {
  return statements.reduce((stmt, curr) => stmt.append(delimiter).append(curr))
}
