import path from 'path'
import Debug from 'debug'
import sqlite3, { Database } from 'better-sqlite3'
import fs from 'fs'
export { Database, Statement } from 'better-sqlite3'

const log = Debug('hypermerge:SqlDatabase')

const migrationsDir = path.resolve(__dirname, './migrations')

export function open(storage: string, memory: boolean): Database {
  const db = new sqlite3(storage, { memory })
  migrate(db)
  return db
}

// example: 0001_name.sql
const migrationFilenamePattern = /^(?<sequence>\d+)_(?<name>.*?)\.sql$/

interface Migration {
  sequence: number
  name: string
  forward: string
  backward: string
}

function migrate(db: Database) {
  log('migrating...')
  ensureMigrationTable(db)
  const migrations = getMigrations(migrationsDir)
  applyBackwardMigrations(migrations, db)
  applyForwardMigrations(migrations, db)
  log('migration complete')
}

function getMigrations(migrationDir: string): Migration[] {
  const files = fs.readdirSync(migrationDir)
  const migrationFiles = files.filter((file) => migrationFilenamePattern.test(file))
  return migrationFiles.map((file) => fileToMigration(path.join(migrationDir, file)))
}

function fileToMigration(migrationFile: string): Migration {
  // TODO: THIS DOESN'T SPLIT THE NAME OUT CORRECTLY. USE THE PATTERN ABOVE
  const [sequence, name] = migrationFile.slice(0, -4).split('_')
  const content = fs.readFileSync(migrationFile, 'utf-8')
  const [forward, backward] = content.split(/^--\s+?down\b/im)
  if (!backward) {
    throw new Error(`The ${name} migration is missing the backwards migration.`)
  }
  return {
    sequence: parseInt(sequence, 10),
    name: name,
    forward: forward.replace(/^-- .?$/gm, '').trim(),
    backward: backward.replace(/^-- .?$/gm, '').trim(),
  }
}

// Create a database table for migrations meta data if it doesn't exist
function ensureMigrationTable(db: Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS Migration (
    sequence INTEGER PRIMARY KEY, 
    name TEXT NOT NULL, 
    forward TEXT NOT NULL, 
    backward TEXT NOT NULL
  )`)
}

function getAppliedMigrations(db: Database): Migration[] {
  return db.prepare('SELECT * FROM Migration ORDER BY sequence ASC').all()
}

// Undo migrations that exist only in the database but not in files,
function applyBackwardMigrations(migrations: Migration[], db: Database) {
  const appliedMigrations = getAppliedMigrations(db)
  const migrationIds = new Set(migrations.map((m) => m.sequence))
  // migrations which were previously applied, but are no longer in migrations list.
  const backwardMigrations = appliedMigrations.filter((m) => migrationIds.has(m.sequence))
  backwardMigrations.sort(descending).forEach((m) => migrateBackward(db, m))
}

function migrateBackward(db: Database, migration: Migration) {
  const trans = db.transaction((migration: Migration) => {
    db.exec(migration.backward)
    db.prepare('DELETE FROM Migration WHERE sequence=?').run(migration.sequence)
  })
  trans(migration)
}

// Note: Assumes applyBackwardMigrations has already been run.
function applyForwardMigrations(migrations: Migration[], db: Database) {
  const appliedMigrations = getAppliedMigrations(db)
  const appliedMigrationIds = new Set(appliedMigrations.map((m) => m.sequence))
  // migrations which aren't yet applied.
  const forwardMigrations = migrations.filter((m) => !appliedMigrationIds.has(m.sequence))
  forwardMigrations.sort(ascending).forEach((m) => migrateForward(db, m))
}

function migrateForward(db: Database, migration: Migration) {
  const trans = db.transaction((migration: Migration) => {
    db.exec(migration.forward)
    db.prepare('INSERT INTO Migration (sequence, name, forward, backward) VALUES (?, ?, ?, ?)').run(
      migration.sequence,
      migration.name,
      migration.forward,
      migration.backward
    )
  })
  trans(migration)
}
function ascending(m1: Migration, m2: Migration) {
  return Math.sign(m1.sequence - m2.sequence)
}

function descending(m1: Migration, m2: Migration) {
  return Math.sign(m2.sequence - m1.sequence)
}
