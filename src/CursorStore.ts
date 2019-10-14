import { RepoId, DocId, ActorId } from './Misc'
import { Clock } from './Clock'
import { Database, Statement } from './SqlDatabase'
import Queue from './Queue'

interface CursorRow {
  repoId: RepoId
  documentId: DocId
  actorId: ActorId
  seq: number
}

type CursorEntry = [ActorId, number]
type CursorDescriptor = [Clock, DocId, RepoId]

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

  get(repoId: RepoId, docId: DocId): Clock {
    const rows = this.preparedGet.all(repoId, docId)
    return rowsToCursor(rows)
  }

  update(repoId: RepoId, docId: DocId, cursor: Clock): CursorDescriptor {
    const transaction = this.db.transaction((cursorEntries) => {
      cursorEntries.forEach(([actorId, seq]: CursorEntry) => {
        this.preparedInsert.run(repoId, docId, actorId, boundedSeq(seq))
      })
      return this.get(repoId, docId)
    })
    const updatedCursor = transaction(Object.entries(cursor))
    const descriptor: CursorDescriptor = [updatedCursor, docId, repoId]
    this.updateQ.push(descriptor)
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

  addActor(repoId: RepoId, docId: DocId, actorId: ActorId, seq: number = Infinity) {
    return this.update(repoId, docId, { [actorId]: boundedSeq(seq) })
  }
}

function rowsToCursor(rows: CursorRow[]): Clock {
  return rows.reduce((clock: Clock, row: CursorRow) => {
    clock[row.actorId] = row.seq
    return clock
  }, {})
}

function boundedSeq(seq: number) {
  return Math.max(0, Math.min(seq, Number.MAX_SAFE_INTEGER))
}
