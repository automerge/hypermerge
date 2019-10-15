import { RepoId, DocId, ActorId } from './Misc'
import * as Clock from './Clock'
import { Database, Statement } from './SqlDatabase'
import Queue from './Queue'

interface CursorRow {
  repoId: RepoId
  documentId: DocId
  actorId: ActorId
  seq: number
}

export type Cursor = Clock.Clock
export type CursorEntry = [ActorId, number]
export type CursorDescriptor = [Cursor, DocId, RepoId]

export const MAX_ENTRY_VALUE = Number.MAX_SAFE_INTEGER

export default class CursorStore {
  private db: Database
  private preparedGet: Statement<[string, string]>
  private preparedInsert: Statement<[string, string, string, number]>
  private preparedEntry: Statement<[string, string, string]>
  private preparedDocsWithActor: Statement<[string, string, number]>
  updateQ: Queue<CursorDescriptor>
  constructor(db: Database) {
    this.db = db
    this.updateQ = new Queue()
    this.preparedGet = this.db.prepare('SELECT * FROM Cursors WHERE repoId = ? AND documentId = ?')
    this.preparedInsert = this.db.prepare(
      `INSERT INTO Cursors (repoId, documentId, actorId, seq)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (repoId, documentId, actorId)
         DO UPDATE SET seq = excluded.seq WHERE excluded.seq > seq`
    )
    this.preparedEntry = this.db
      .prepare('SELECT seq FROM Cursors WHERE repoId = ? AND documentId = ? AND actorId = ?')
      .pluck()
    this.preparedDocsWithActor = this.db
      .prepare('SELECT documentId FROM Cursors WHERE repoId = ? AND actorId = ? AND seq >= ?')
      .pluck()
  }

  // NOTE: We return an empty cursor when we don't have a stored cursor. We want
  // to return undefined instead.
  get(repoId: RepoId, docId: DocId): Cursor {
    const rows = this.preparedGet.all(repoId, docId)
    return rowsToCursor(rows)
  }

  update(repoId: RepoId, docId: DocId, cursor: Cursor): CursorDescriptor {
    const transaction = this.db.transaction((cursorEntries) => {
      cursorEntries.forEach(([actorId, seq]: CursorEntry) => {
        this.preparedInsert.run(repoId, docId, actorId, boundedSeq(seq))
      })
      return this.get(repoId, docId)
    })
    const updatedCursor = transaction(Object.entries(cursor))
    const descriptor: CursorDescriptor = [updatedCursor, docId, repoId]
    if (!Clock.equal(cursor, updatedCursor)) {
      this.updateQ.push(descriptor)
    }
    return descriptor
  }

  // NOTE: We return 0 if we don't have a cursor value. This is for backwards compatibility
  // with metadata. This might not be the right thing to do.
  entry(repoId: RepoId, docId: DocId, actorId: ActorId): number {
    return this.preparedEntry.get(repoId, docId, actorId) || 0
  }

  // TODO: Should we return cursors and doc ids instead of just doc ids? Look at usage.
  docsWithActor(repoId: RepoId, actorId: ActorId, seq: number = 0): DocId[] {
    return this.preparedDocsWithActor.all(repoId, actorId, boundedSeq(seq))
  }

  addActor(repoId: RepoId, docId: DocId, actorId: ActorId, seq: number = MAX_ENTRY_VALUE) {
    return this.update(repoId, docId, { [actorId]: boundedSeq(seq) })
  }
}

function rowsToCursor(rows: CursorRow[]): Cursor {
  return rows.reduce((clock: Cursor, row: CursorRow) => {
    clock[row.actorId] = row.seq
    return clock
  }, {})
}

function boundedSeq(seq: number) {
  return Math.max(0, Math.min(seq, MAX_ENTRY_VALUE))
}
