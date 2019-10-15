import test from 'tape'
import * as SqlDatabase from '../src/SqlDatabase'
import CursorStore, { INFINITY_SEQ } from '../src/CursorStore'
import { RepoId, DocId } from '../src/Misc'

test('ClockStore', (t) => {
  t.test('read and write', async (t) => {
    t.plan(1)
    const repoId = 'repoId' as RepoId
    const db = SqlDatabase.open('test.db', true)
    const cursorStore = new CursorStore(db)

    const docId = 'abc123' as DocId
    const clock = { abc123: Infinity, def456: 0 }
    cursorStore.update(repoId, docId, clock)
    const readClock = cursorStore.get(repoId, docId)
    t.deepEqual(readClock, { abc123: INFINITY_SEQ, def456: 0 })

    db.close()
  })

  t.test('upsert', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const cursorStore = new CursorStore(db)

    const repoId = 'repoId' as RepoId
    const docId = 'abc123' as DocId
    const cursor = { abc123: 1, def456: 0 }
    cursorStore.update(repoId, docId, cursor)
    const updatedCursor = { abc123: 2, def456: 0 }
    cursorStore.update(repoId, docId, updatedCursor)
    const readClock = cursorStore.get(repoId, docId)
    t.deepEqual(readClock, updatedCursor)
    db.close()
  })
})
