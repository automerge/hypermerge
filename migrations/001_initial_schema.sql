-- Up
CREATE TABLE IF NOT EXISTS DocumentClock (
    documentId TEXT PRIMARY KEY,
    clock TEXT
) WITHOUT ROWID;

-- Down
DROP TABLE IF EXISTS DocumentClock;