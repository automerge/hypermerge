import { RepoId, DocId, ActorId } from './Misc'
import { Clock } from './Clock'
import { Database, Statement } from './SqlDatabase'

export interface ClockMap {
  [documentId: string /*DocId*/]: Clock
}

export type ClockUpdate = [RepoId, DocId, Clock]

interface ClockRow {
  repoId: string
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
  private preparedGet: Statement<[RepoId, DocId]>
  private preparedInsert: Statement<[RepoId, DocId, ActorId, number]>
  private preparedDelete: Statement<[RepoId, DocId]>
  private preparedAllDocumentIds: Statement<[RepoId]>

  constructor(db: Database) {
    this.db = db

    this.preparedGet = this.db.prepare(`SELECT * FROM Clocks WHERE repoId=? AND documentId=?`)
    this.preparedInsert = this.db.prepare(
      `INSERT INTO Clocks (repoId, documentId, actorId, seq)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (repoId, documentId, actorId)
       DO UPDATE SET seq=excluded.seq WHERE excluded.seq > seq`
    )
    this.preparedDelete = this.db.prepare('DELETE FROM Clocks WHERE repoId=? AND documentId=?')
    this.preparedAllDocumentIds = this.db.prepare(
      'SELECT DISTINCT documentId from Clocks WHERE repoId=?'
    )
  }

  /**
   * TODO: handle missing clocks better. Currently returns an empty clock (i.e. an empty object)
   */
  get(repoId: RepoId, documentId: DocId): Clock {
    const clockRows = this.preparedGet.all(repoId, documentId)
    return rowsToClock(clockRows)
  }

  /**
   * Retrieve the clocks for all given documents. If we don't have a clock
   * for a document, the resulting ClockMap won't have an entry for that document id.
   */
  getMultiple(repoId: RepoId, documentIds: DocId[]): ClockMap {
    const transaction = this.db.transaction((docIds: DocId[]) => {
      return docIds.reduce((clockMap: ClockMap, docId: DocId) => {
        const clock = this.get(repoId, docId)
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
  update(repoId: RepoId, documentId: DocId, clock: Clock): ClockUpdate {
    const transaction = this.db.transaction((clockEntries) => {
      clockEntries.forEach(([feedId, seq]: ClockEntry) => {
        this.preparedInsert.run(repoId, documentId, feedId, seq)
      })
      return this.get(repoId, documentId)
    })
    const updatedClock = transaction(Object.entries(clock))
    return [repoId, documentId, updatedClock]
  }

  /**
   * Hard set of a clock. Will clear any clock values that exist for the given document id
   * and set explicitly the passed in clock.
   */
  set(repoId: RepoId, documentId: DocId, clock: Clock): ClockUpdate {
    const transaction = this.db.transaction((documentId, clock) => {
      this.preparedDelete.run(repoId, documentId)
      return this.update(repoId, documentId, clock)
    })
    return transaction(documentId, clock)
  }

  getAllDocumentIds(repoId: RepoId): DocId[] {
    return this.preparedAllDocumentIds.all(repoId)
  }
}

function rowsToClock(rows: ClockRow[]): Clock {
  return rows.reduce((clock: Clock, row: ClockRow) => {
    clock[row.actorId] = row.seq
    return clock
  }, {})
}
