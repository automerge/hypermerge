CREATE TABLE IF NOT EXISTS DocumentClock (
    documentId TEXT,
    feedId TEXT,
    seq INTEGER,
    PRIMARY KEY (documentId, feedId)
) WITHOUT ROWID;