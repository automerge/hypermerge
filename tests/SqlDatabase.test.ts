import test from 'tape'
import * as SqlDatabase from '../src/SqlDatabase'

function flat(arr: any[]): any[] {
  return [].concat(...arr)
}

function getTables(db: SqlDatabase.Database) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';")
    .raw()
    .all()
  // Remove the Migration table
  return flat(tables).filter((name) => name !== 'Migration')
}

test('SqlDatabase', (t) => {
  t.test('no migrations', async (t) => {
    const db = SqlDatabase.open('test.db', true)
    SqlDatabase.migrate([], db)
    t.deepEqual(getTables(db), [])
    db.close()
    t.end()
  })
  t.test('migrate forward one', async (t) => {
    const migrations = [
      {
        name: '1',
        up: 'CREATE TABLE IF NOT EXISTS test ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test',
      },
    ]
    const db = SqlDatabase.open('test.db', true)
    SqlDatabase.migrate(migrations, db)
    t.deepEqual(getTables(db), ['test'])
    db.close()
    t.end()
  })

  t.test('migrate forward multiple', async (t) => {
    const migrations = [
      {
        name: '1',
        up: 'CREATE TABLE IF NOT EXISTS test ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test',
      },
      {
        name: '2',
        up: 'CREATE TABLE IF NOT EXISTS test2 ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test2',
      },
    ]
    const db = SqlDatabase.open('test.db', true)
    SqlDatabase.migrate(migrations, db)
    t.deepEqual(getTables(db), ['test', 'test2'])
    db.close()
    t.end()
  })

  t.test('migrate forward and back', async (t) => {
    const migrations = [
      {
        name: '1',
        up: 'CREATE TABLE IF NOT EXISTS test ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test',
      },
      {
        name: '2',
        up: 'CREATE TABLE IF NOT EXISTS test2 ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test2',
      },
    ]
    const db = SqlDatabase.open('test.db', true)
    SqlDatabase.migrate(migrations, db)
    t.deepEqual(getTables(db), ['test', 'test2'])
    const migrations2 = [
      {
        name: '1',
        up: 'CREATE TABLE IF NOT EXISTS test ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test',
      },
    ]
    SqlDatabase.migrate(migrations2, db)
    t.deepEqual(getTables(db), ['test'])
    db.close()
    t.end()
  })
  t.test('migrate backward multiple', async (t) => {
    const migrations = [
      {
        name: '1',
        up: 'CREATE TABLE IF NOT EXISTS test ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test',
      },
      {
        name: '2',
        up: 'CREATE TABLE IF NOT EXISTS test2 ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test2',
      },
      {
        name: '3',
        up: 'CREATE TABLE IF NOT EXISTS test3 ( id INTEGER PRIMARY KEY );',
        down: 'DROP TABLE IF EXISTS test3',
      },
    ]
    const db = SqlDatabase.open('test.db', true)
    SqlDatabase.migrate(migrations, db)
    t.deepEqual(getTables(db), ['test', 'test2', 'test3'])
    SqlDatabase.migrate([], db)
    t.deepEqual(getTables(db), [])
    db.close()
    t.end()
  })
})
