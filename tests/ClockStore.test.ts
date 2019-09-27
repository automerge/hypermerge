import test from 'tape'
import * as SqlDatabase from '../src/SqlDatabase'
import ClockStore from '../src/ClockStore'
import { DocId } from '../src/Misc'

test('ClockStore', (t) => {
  t.test('read and write', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(docId, clock)
    const readClock = clockStore.get(docId)
    t.deepEqual(readClock, clock)

    db.close()
  })

  t.test('upsert', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(docId, clock)
    const updatedClock = { abc123: 2, def456: 0 }
    clockStore.update(docId, updatedClock)
    const readClock = clockStore.get(docId)
    t.deepEqual(readClock, updatedClock)
    db.close()
  })

  t.test('set', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.set(docId, clock)
    const updatedClock = { abc123: 2 }
    clockStore.set(docId, updatedClock)
    const readClock = clockStore.get(docId)
    t.deepEqual(readClock, updatedClock)
    db.close()
  })

  t.test('get multiple', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(docId, clock)

    const docId2 = 'ghi789' as DocId
    const clock2 = { ghi789: 2, jkl012: 0 }
    clockStore.update(docId2, clock2)

    const clocks = clockStore.getMultiple([docId, docId2])
    const expectedClocks = {
      [docId]: clock,
      [docId2]: clock2,
    }
    t.deepEqual(clocks, expectedClocks)
    db.close()
  })
})
