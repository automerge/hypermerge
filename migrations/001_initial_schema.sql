-- Up
CREATE TABLE IF NOT EXISTS DocumentClock (
    documentId TEXT,
    feedId TEXT,
    clockValue INTEGER,
    PRIMARY KEY (documentId, feedId)
) WITHOUT ROWID;

-- Down
DROP TABLE IF EXISTS DocumentClock;