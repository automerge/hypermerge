-- Up
CREATE TABLE DocumentClock (
    documentId TEXT PRIMARY KEY,
    clock TEXT
) WITHOUT ROWID;

-- Down
DROP TABLE DocumentClock;