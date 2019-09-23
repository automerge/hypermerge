import test from 'tape'
import SQLStore from '../src/SQLStore'
import ClockStore from '../src/CLockStore'
import { DocId } from '../src/Misc'

test('SQLStore', (t) => {
  t.test('read and write', async (t) => {
    t.plan(1)
    const sqlStore = new SQLStore(':memory:')
    const clockStore = new ClockStore(sqlStore)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    await clockStore.set(docId, clock)
    console.log('set')
    const readClock = await clockStore.get(docId)
    t.deepEqual(clock, readClock)

    sqlStore.close()
  })

  t.test('upsert', async (t) => {
    t.plan(1)
    const sqlStore = new SQLStore(':memory:')
    const clockStore = new ClockStore(sqlStore)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    await clockStore.set(docId, clock)
    const updatedClock = { abc123: 2, def456: 0 }
    await clockStore.set(docId, updatedClock)
    const readClock = await clockStore.get(docId)
    t.deepEqual(readClock, updatedClock)
  })

  t.test('fails to remove old feeds', async (t) => {
    t.plan(1)
    const sqlStore = new SQLStore(':memory:')
    const clockStore = new ClockStore(sqlStore)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    await clockStore.set(docId, clock)
    const updatedClock = { abc123: 2 }
    await clockStore.set(docId, updatedClock)
    const readClock = await clockStore.get(docId)
    t.deepEqual(readClock, { abc123: 2, def456: 0 })
  })
})
