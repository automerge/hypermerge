"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Clock = __importStar(require("./Clock"));
const Queue_1 = __importDefault(require("./Queue"));
exports.INFINITY_SEQ = Number.MAX_SAFE_INTEGER;
class CursorStore {
    constructor(db) {
        this.db = db;
        this.updateQ = new Queue_1.default();
        this.preparedGet = this.db.prepare('SELECT * FROM Cursors WHERE repoId = ? AND documentId = ?');
        this.preparedInsert = this.db.prepare(`INSERT INTO Cursors (repoId, documentId, actorId, seq)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (repoId, documentId, actorId)
         DO UPDATE SET seq = excluded.seq WHERE excluded.seq > seq`);
        this.preparedEntry = this.db
            .prepare('SELECT seq FROM Cursors WHERE repoId = ? AND documentId = ? AND actorId = ?')
            .pluck();
        this.preparedDocsWithActor = this.db
            .prepare('SELECT documentId FROM Cursors WHERE repoId = ? AND actorId = ? AND seq >= ?')
            .pluck();
    }
    // NOTE: We return an empty cursor when we don't have a stored cursor. We might want
    // to return undefined instead.
    get(repoId, docId) {
        const rows = this.preparedGet.all(repoId, docId);
        return rowsToCursor(rows);
    }
    update(repoId, docId, cursor) {
        const transaction = this.db.transaction((cursorEntries) => {
            cursorEntries.forEach(([actorId, seq]) => {
                this.preparedInsert.run(repoId, docId, actorId, boundedSeq(seq));
            });
            return this.get(repoId, docId);
        });
        const updatedCursor = transaction(Object.entries(cursor));
        const descriptor = [updatedCursor, docId, repoId];
        if (!Clock.equal(cursor, updatedCursor)) {
            this.updateQ.push(descriptor);
        }
        return descriptor;
    }
    // NOTE: We return 0 if we don't have a cursor value. This is for backwards compatibility
    // with metadata. This might not be the right thing to do.
    entry(repoId, docId, actorId) {
        return this.preparedEntry.get(repoId, docId, actorId) || 0;
    }
    // TODO: Should we return cursors and doc ids instead of just doc ids? Look at usage.
    docsWithActor(repoId, actorId, seq = 0) {
        return this.preparedDocsWithActor.all(repoId, actorId, boundedSeq(seq));
    }
    addActor(repoId, docId, actorId, seq = exports.INFINITY_SEQ) {
        return this.update(repoId, docId, { [actorId]: boundedSeq(seq) });
    }
}
exports.default = CursorStore;
function rowsToCursor(rows) {
    return rows.reduce((clock, row) => {
        clock[row.actorId] = row.seq;
        return clock;
    }, {});
}
function boundedSeq(seq) {
    return Math.max(0, Math.min(seq, exports.INFINITY_SEQ));
}
//# sourceMappingURL=CursorStore.js.map