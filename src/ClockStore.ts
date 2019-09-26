import { DocId } from './Misc'
import { FeedId } from './FeedStore'
import SQLStore from './SQLStore'
import { Clock } from './Clock'
import Queue from './Queue'
import { Statement } from 'better-sqlite3'

export interface ClockMap {
  [documentId: string /*DocId*/]: Clock
}

export type ClockUpdate = [DocId, Clock]

interface ClockRow {
  documentId: string
  feedId: string
  seq: number
}

type ClockEntry = [FeedId, number]

// NOTE: Joshua Wise (maintainer of better-sqlite3) suggests using multiple
// prepared statements rather than batch inserts and selects :shrugging-man:.
// We'll see if this becomes an issue.
export default class ClockStore {
  store: SQLStore
  updateLog: Queue<ClockUpdate> = new Queue()
  private preparedGet: Statement<DocId>
  private preparedInsert: Statement<[DocId, FeedId, number]>
  private preparedDelete: Statement<DocId>
  constructor(store: SQLStore) {
    this.store = store

    this.preparedGet = this.store.db.prepare('SELECT * FROM DocumentClock WHERE documentId=?')
    this.preparedInsert = this.store.db.prepare(
      `INSERT INTO DocumentClock (documentId, feedId, seq) 
       VALUES (?, ?, ?) 
       ON CONFLICT (documentId, feedId) 
       DO UPDATE SET seq=excluded.seq WHERE excluded.seq > seq`
    )
    this.preparedDelete = this.store.db.prepare('DELETE FROM DocumentClock WHERE documentId=?')
  }

  /**
   * TODO: handle missing clocks better. Currently returns an empty clock (i.e. an empty object)
   * @param documentId
   */
  get(documentId: DocId): Clock {
    const clockRows = this.preparedGet.all(documentId)
    return rowsToClock(clockRows)
  }

  /**
   * Retrieve the clocks for all given documents. If we don't have a clock
   * for a document, the resulting ClockMap won't have an entry for that document id.
   * @param documentIds
   */
  getMultiple(documentIds: DocId[]): ClockMap {
    const transaction = this.store.db.transaction((docIds: DocId[]) => {
      return docIds.reduce((clockMap: ClockMap, docId: DocId) => {
        const clock = this.get(docId)
        if (clock) clockMap[docId] = clock
        return clockMap
      }, {})
    })
    const clockMap = transaction(documentIds)
    return clockMap
  }

  /**
   * Update an existing clock with a new clock, merging the two.
   * If no clock exists in the data store, the new clock is stored as-is.
   * @param documentId
   * @param clock
   */
  update(documentId: DocId, clock: Clock): ClockUpdate {
    const transaction = this.store.db.transaction((clockEntries) => {
      clockEntries.forEach(([feedId, seq]: ClockEntry) => {
        this.preparedInsert.run(documentId, feedId, seq)
      })
      return this.get(documentId)
    })
    const updatedClock = transaction(Object.entries(clock))
    const update: ClockUpdate = [documentId, updatedClock]
    this.updateLog.push(update)
    return update
  }

  /**
   * Hard set of a clock. Will clear any clock values that exist for the given document id
   * and set explicitly the passed in clock.
   * @param documentId
   * @param clock
   */
  set(documentId: DocId, clock: Clock): ClockUpdate {
    const transaction = this.store.db.transaction((documentId, clock) => {
      this.preparedDelete.run(documentId)
      return this.update(documentId, clock)
    })
    return transaction(documentId, clock)
  }
}

function rowsToClock(rows: ClockRow[]): Clock {
  return rows.reduce((clock: Clock, row: ClockRow) => {
    clock[row.feedId] = row.seq
    return clock
  }, {})
}

function rowsToClockMap(rows: ClockRow[]): ClockMap {
  return rows.reduce((clockMap: ClockMap, row: ClockRow) => {
    const clock = clockMap[row.documentId] || {}
    clock[row.feedId] = row.seq
    clockMap[row.documentId] = clock
    return clockMap
  }, {})
}
