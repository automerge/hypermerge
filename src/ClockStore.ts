import { DocId, ActorId } from './Misc'
import { Clock } from './Clock'
import Queue from './Queue'
import { Database, Statement } from './SqlDatabase'

export interface ClockMap {
  [documentId: string /*DocId*/]: Clock
}

export type ClockUpdate = [DocId, Clock]

interface ClockRow {
  documentId: string
  actorId: string
  seq: number
}

type ClockEntry = [ActorId, number]

// NOTE: Joshua Wise (maintainer of better-sqlite3) suggests using multiple
// prepared statements rather than batch inserts and selects :shrugging-man:.
// We'll see if this becomes an issue.
export default class ClockStore {
  db: Database
  private preparedGet: Statement<DocId>
  private preparedInsert: Statement<[DocId, ActorId, number]>
  private preparedDelete: Statement<DocId>
  constructor(db: Database) {
    this.db = db

    this.preparedGet = this.db.prepare(`SELECT * FROM Clock WHERE documentId=?`)
    this.preparedInsert = this.db.prepare(
      `INSERT INTO Clock (documentId, actorId, seq) 
       VALUES (?, ?, ?) 
       ON CONFLICT (documentId, actorId) 
       DO UPDATE SET seq=excluded.seq WHERE excluded.seq > seq`
    )
    this.preparedDelete = this.db.prepare('DELETE FROM Clock WHERE documentId=?')
  }

  /**
   * TODO: handle missing clocks better. Currently returns an empty clock (i.e. an empty object)
   */
  get(documentId: DocId): Clock {
    const clockRows = this.preparedGet.all(documentId)
    return rowsToClock(clockRows)
  }

  /**
   * Retrieve the clocks for all given documents. If we don't have a clock
   * for a document, the resulting ClockMap won't have an entry for that document id.
   */
  getMultiple(documentIds: DocId[]): ClockMap {
    const transaction = this.db.transaction((docIds: DocId[]) => {
      return docIds.reduce((clockMap: ClockMap, docId: DocId) => {
        const clock = this.get(docId)
        if (clock) clockMap[docId] = clock
        return clockMap
      }, {})
    })
    return transaction(documentIds)
  }

  /**
   * Update an existing clock with a new clock, merging the two.
   * If no clock exists in the data store, the new clock is stored as-is.
   */
  update(documentId: DocId, clock: Clock): ClockUpdate {
    const transaction = this.db.transaction((clockEntries) => {
      clockEntries.forEach(([feedId, seq]: ClockEntry) => {
        this.preparedInsert.run(documentId, feedId, seq)
      })
      return this.get(documentId)
    })
    const updatedClock = transaction(Object.entries(clock))
    return [documentId, updatedClock]
  }

  /**
   * Hard set of a clock. Will clear any clock values that exist for the given document id
   * and set explicitly the passed in clock.
   */
  set(documentId: DocId, clock: Clock): ClockUpdate {
    const transaction = this.db.transaction((documentId, clock) => {
      this.preparedDelete.run(documentId)
      return this.update(documentId, clock)
    })
    return transaction(documentId, clock)
  }
}

function rowsToClock(rows: ClockRow[]): Clock {
  return rows.reduce((clock: Clock, row: ClockRow) => {
    clock[row.actorId] = row.seq
    return clock
  }, {})
}
