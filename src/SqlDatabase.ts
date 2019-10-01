import Debug from 'debug'
import sqlite3, { Database } from 'better-sqlite3'
export { Database, Statement } from 'better-sqlite3'
import migrations, { Migration } from './SqlMigrations'

const log = Debug('hypermerge:SqlDatabase')

export function init(storage: string, memory: boolean): Database {
  const db = open(storage, memory)
  migrate(migrations, db)
  return db
}

export function open(storage: string, memory: boolean): Database {
  return new sqlite3(storage, { memory })
}

export function migrate(migrations: Migration[], db: Database) {
  log('migrating...')
  ensureMigrationTable(db)
  applyBackwardMigrations(migrations, db)
  applyForwardMigrations(migrations, db)
  log('migration complete')
}

interface MigrationRow {
  sequence: number
  name: string
  up: string
  down: string
}

// Create a database table for migrations meta data if it doesn't exist
function ensureMigrationTable(db: Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS Migration (
    sequence INTEGER PRIMARY KEY, 
    name TEXT UNIQUE NOT NULL, 
    up TEXT NOT NULL, 
    down TEXT NOT NULL
  )`)
}

// Undo migrations that exist only in the database but not in the migrations list
function applyBackwardMigrations(migrations: Migration[], db: Database) {
  const backwardMigrations: MigrationRow[] = db
    .prepare('SELECT * FROM Migration WHERE sequence > ? ORDER BY sequence DESC')
    .all(migrations.length)
  backwardMigrations.forEach((m) => migrateBackward(db, m))
}

function migrateBackward(db: Database, migration: MigrationRow) {
  const trans = db.transaction((migration: MigrationRow) => {
    db.exec(migration.down)
    db.prepare('DELETE FROM Migration WHERE sequence=?').run(migration.sequence)
  })
  trans(migration)
}

// Note: Assumes applyBackwardMigrations has already been run.
function applyForwardMigrations(migrations: Migration[], db: Database) {
  const maxAppliedMigration = db
    .prepare('SELECT MAX(sequence) FROM Migration;')
    .pluck()
    .get()
  const startSequence = maxAppliedMigration + 1
  migrations
    .slice(maxAppliedMigration)
    .forEach((m, index) => migrateForward(db, startSequence + index, m))
}

function migrateForward(db: Database, sequence: number, migration: Migration) {
  const trans = db.transaction((migration: Migration) => {
    db.exec(migration.up)
    db.prepare('INSERT INTO Migration (sequence, name, up, down) VALUES (?, ?, ?, ?)').run(
      sequence,
      migration.name,
      migration.up,
      migration.down
    )
  })
  trans(migration)
}
