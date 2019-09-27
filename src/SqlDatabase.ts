import path from 'path'
import Debug from 'debug'
import sqlite3, { Database } from 'better-sqlite3'
import fs from 'fs'
export { Database, Statement } from 'better-sqlite3'

const log = Debug('hypermerge:Database')

const migrationsPath = path.resolve(__dirname, './migrations/0001_initial_schema.sql')

export function open(storage: string, memory: boolean): Database {
  const db = new sqlite3(storage, { memory })
  migrate(db)
  return db
}

function migrate(db: sqlite3.Database): void {
  log('migrating...')
  const migration = fs.readFileSync(migrationsPath, { encoding: 'utf-8' })
  db.exec(migration)
  log('migration complete')
}
