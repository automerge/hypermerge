import test from 'tape'
import * as SqlDatabase from '../src/SqlDatabase'
import * as Keys from '../src/Keys'
import KeyStore from '../src/KeyStore'

test('KeyStore', (t) => {
  t.test('read and write', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const keyStore = new KeyStore(db)
    const keys = Keys.createBuffer()
    keyStore.set('foo', keys)
    const result = keyStore.get('foo')
    t.deepEqual(result, keys)
    db.close()
  })

  t.test('overwrite', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const keyStore = new KeyStore(db)
    const keys = Keys.createBuffer()
    keyStore.set('foo', keys)
    const keys2 = Keys.createBuffer()
    keyStore.set('foo', keys2)
    const result = keyStore.get('foo')
    t.deepEqual(result, keys2)
    db.close()
  })

  t.test('clear', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const keyStore = new KeyStore(db)
    const keys = Keys.createBuffer()
    keyStore.set('foo', keys)
    keyStore.clear('foo')
    const result = keyStore.get('foo')
    t.equal(result, undefined)
    db.close()
  })
})
