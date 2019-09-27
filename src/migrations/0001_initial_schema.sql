-- Up
CREATE TABLE IF NOT EXISTS Clock (
    documentId TEXT,
    actorId TEXT,
    seq INTEGER,
    PRIMARY KEY (documentId, actorId)
) WITHOUT ROWID;

-- Down
DROP TABLE IF EXISTS Clock;