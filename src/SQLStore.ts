import path from 'path'
import Debug from 'debug'
import sqlite3 from 'better-sqlite3'
import fs from 'fs'

const log = Debug('hypermerge:SqlStore')

export const IN_MEMORY_DB = ':memory:'
const migrationsPath = path.resolve(__dirname, './migrations/0001_initial_schema.sql')

// TODO: more robust migrations
export default class SqlStore {
  db: sqlite3.Database

  constructor(storage: string) {
    this.db = sqlite3(storage, { memory: storage === IN_MEMORY_DB })
    this.migrate()
    process.on('exit', () => this.close())
    // process.on('SIGHUP', () => process.exit(128 + 1));
    // process.on('SIGINT', () => process.exit(128 + 2));
    // process.on('SIGTERM', () => process.exit(128 + 15));
  }
  migrate() {
    log('migrating...')
    const migration = fs.readFileSync(migrationsPath, { encoding: 'utf8' })
    this.db.exec(migration)
    log('migration complete')
  }
  close() {
    this.db.close()
  }
}
