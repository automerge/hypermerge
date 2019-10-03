import test from 'tape'
import * as SqlDatabase from '../src/SqlDatabase'
import ClockStore from '../src/ClockStore'
import { RepoId, DocId } from '../src/Misc'

test('ClockStore', (t) => {
  t.test('read and write', async (t) => {
    t.plan(1)
    const repoId = 'repoId' as RepoId
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(repoId, docId, clock)
    const readClock = clockStore.get(repoId, docId)
    t.deepEqual(readClock, clock)

    db.close()
  })

  t.test('upsert', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const repoId = 'repoId' as RepoId
    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(repoId, docId, clock)
    const updatedClock = { abc123: 2, def456: 0 }
    clockStore.update(repoId, docId, updatedClock)
    const readClock = clockStore.get(repoId, docId)
    t.deepEqual(readClock, updatedClock)
    db.close()
  })

  t.test('set', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const repoId = 'repoId' as RepoId
    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.set(repoId, docId, clock)
    const updatedClock = { abc123: 2 }
    clockStore.set(repoId, docId, updatedClock)
    const readClock = clockStore.get(repoId, docId)
    t.deepEqual(readClock, updatedClock)
    db.close()
  })

  t.test('get multiple', async (t) => {
    t.plan(1)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const repoId = 'repoId' as RepoId
    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(repoId, docId, clock)

    const docId2 = 'ghi789' as DocId
    const clock2 = { ghi789: 2, jkl012: 0 }
    clockStore.update(repoId, docId2, clock2)

    const clocks = clockStore.getMultiple(repoId, [docId, docId2])
    const expectedClocks = {
      [docId]: clock,
      [docId2]: clock2,
    }
    t.deepEqual(clocks, expectedClocks)
    db.close()
  })

  t.test('get with multiple repos', (t) => {
    t.plan(2)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const repoId = 'repoId' as RepoId
    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(repoId, docId, clock)

    const docId2 = 'ghi789' as DocId
    const clock2 = { ghi789: 2, jkl012: 0 }
    clockStore.update(repoId, docId2, clock2)

    const repoId2 = 'repoId2' as RepoId
    const clock3 = { abc123: 1, def456: 1 }
    clockStore.update(repoId2, docId, clock3)

    const res2 = clockStore.get(repoId2, docId)

    const clocks = clockStore.getMultiple(repoId, [docId, docId2])
    const expectedClocks = {
      [docId]: clock,
      [docId2]: clock2,
    }
    t.deepEqual(clocks, expectedClocks)
    t.deepEqual(res2, clock3)
    db.close()
  })

  t.test('update with multiple repos', (t) => {
    t.plan(2)
    const db = SqlDatabase.open('test.db', true)
    const clockStore = new ClockStore(db)

    const repoId = 'repoId' as RepoId
    const docId = 'abc123' as DocId
    const clock = { abc123: 1, def456: 0 }
    clockStore.update(repoId, docId, clock)

    const repoId2 = 'repoId2' as RepoId
    const clock2 = { abc123: 1, def456: 1 }
    clockStore.update(repoId2, docId, clock2)

    const clock3 = { abc123: 2, def456: 0 }
    clockStore.update(repoId, docId, clock3)

    const res1 = clockStore.get(repoId, docId)
    const res2 = clockStore.get(repoId2, docId)
    t.deepEqual(res1, clock3)
    t.deepEqual(res2, clock2)
    db.close()
  })
})
