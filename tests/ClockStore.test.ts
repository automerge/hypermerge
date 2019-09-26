import test from 'tape'
import SqlStore, { IN_MEMORY_DB } from '../src/SqlStore'
import ClockStore from '../src/ClockStore'
import { DocId } from '../src/Misc'

test('ClockStore', (t) => {
  t.test('read and write', async (t) => {
    t.plan(1)
    const sqlStore = new SqlStore(IN_MEMORY_DB)
    const clockStore = new ClockStore(sqlStore)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(docId, clock)
    const readClock = clockStore.get(docId)
    t.deepEqual(readClock, clock)

    sqlStore.close()
  })

  t.test('upsert', async (t) => {
    t.plan(1)
    const sqlStore = new SqlStore(IN_MEMORY_DB)
    const clockStore = new ClockStore(sqlStore)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(docId, clock)
    const updatedClock = { abc123: 2, def456: 0 }
    clockStore.update(docId, updatedClock)
    const readClock = clockStore.get(docId)
    t.deepEqual(readClock, updatedClock)
    sqlStore.close()
  })

  t.test('set', async (t) => {
    t.plan(1)
    const sqlStore = new SqlStore(IN_MEMORY_DB)
    const clockStore = new ClockStore(sqlStore)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.set(docId, clock)
    const updatedClock = { abc123: 2 }
    clockStore.set(docId, updatedClock)
    const readClock = clockStore.get(docId)
    t.deepEqual(readClock, updatedClock)
    sqlStore.close()
  })

  // t.test('absolutely sets clock', async (t) => {
  //   t.plan(1)
  //   const sqlStore = new SQLStore(':memory:')
  //   const clockStore = new ClockStore(sqlStore)

  //   const docId = 'abc123' as DocId
  //   const clock = { abc123: 1, def456: 0 }
  //   await clockStore.set(docId, clock)
  //   const updatedClock = { abc123: 2 }
  //   await clockStore.set(docId, updatedClock)
  //   const readClock = await clockStore.get(docId)
  //   t.deepEqual(readClock, { abc123: 2 })
  //   sqlStore.close()
  // })

  t.test('get multiple', async (t) => {
    t.plan(1)
    const sqlStore = new SqlStore(IN_MEMORY_DB)
    const clockStore = new ClockStore(sqlStore)

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
    sqlStore.close()
  })
})
