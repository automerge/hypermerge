import test from 'tape'
import * as SqlDatabase from '../src/SqlDatabase'
import KeyValueStore from '../src/KeyValueStore'

test('KeyValueStore', (t) => {
  t.test('read and write', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const kvStore = new KeyValueStore(db)
    kvStore.set('foo', 'bar')
    const result = kvStore.get('foo')
    t.equal(result, 'bar')
    db.close()
  })

  t.test('overwrite', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const kvStore = new KeyValueStore(db)
    kvStore.set('foo', 'bar')
    kvStore.set('foo', 'baz')
    const result = kvStore.get('foo')
    t.equal(result, 'baz')
    db.close()
  })

  t.test('clear', async (t) => {
    t.plan(2)
    const db = SqlDatabase.open('test.db', true)
    const kvStore = new KeyValueStore(db)
    kvStore.set('foo', 'bar')
    const result = kvStore.get('foo')
    t.equal(result, 'bar')
    kvStore.clear('foo')
    const result2 = kvStore.get('foo')
    t.equal(result2, undefined)
    db.close()
  })
})
