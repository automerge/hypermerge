import sqlite from 'sqlite'
import { SQLStatement } from 'sql-template-strings'
import path from 'path'
import Debug from 'debug'

export { default as SQL } from 'sql-template-strings'

const log = Debug('hypermerge:SQLStore')

// Migration path will default to the INIT_CWD/migrations, which will
// not be what we want when using hypermerge as a dependency of another
// project.
const migrationsPath = path.resolve(__dirname, '../migrations')

export default class SQLStore {
  private dbPromise: Promise<sqlite.Database>

  constructor(storage: string) {
    this.dbPromise = Promise.resolve()
      .then(() => {
        log('opening database...')
        return sqlite.open(storage)
      })
      .then((db) => {
        log('migrating database...')
        return db.migrate({ force: 'last', migrationsPath })
      })
      .then(effect(() => log('database ready')))
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
    await db.close()
    log('database closed')
  }
}

// Join multiple statements with a delimiter.
export function joinStatements(statements: SQLStatement[], delimiter: string) {
  return statements.reduce((stmt, curr) => stmt.append(delimiter).append(curr))
}

function effect(effectFn: Function) {
  // TODO: multiple args!
  return function<T>(arg: T): T {
    effectFn()
    return arg
  }
}
