CREATE TABLE IF NOT EXISTS Clock (
    documentId TEXT,
    actorId TEXT,
    seq INTEGER,
    PRIMARY KEY (documentId, actorId)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS KeyValue (
    k TEXT PRIMARY KEY,
    v TEXT
) WITHOUT ROWID;