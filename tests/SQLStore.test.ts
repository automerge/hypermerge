import test from 'tape'
import SQLStore from '../src/SQLStore'
import ClockStore from '../src/CLockStore'
import { DocId } from '../src/Misc'

test('SQLStore', (t) => {
  const sqlStore = new SQLStore(':memory:')
  const clockStore = new ClockStore(sqlStore)

  t.test('read and write', async (t) => {
    t.plan(1)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    await clockStore.set(docId, clock)
    console.log('set')
    const readClock = await clockStore.get(docId)
    t.deepEqual(clock, readClock)
  })
})
