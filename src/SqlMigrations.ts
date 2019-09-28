export interface Migration {
  name: string
  up: string
  down: string
}

/**
 * Migrations are identified by their name and applied in the order they
 * are listed here. We list them here rather than as .sql files to avoid
 * having to readFile on boot.
 * The up and down blocks may contain multiple statments.
 * All statements within a single up or down block will be run within a transaction.
 * TODO: store these in SQL files and compile into a file like this one as a build step.
 */
const migrations: Migration[] = [
  {
    name: 'Initial schema',
    up: `
    CREATE TABLE IF NOT EXISTS Clock (
        documentId TEXT,
        actorId TEXT,
        seq INTEGER,
        PRIMARY KEY (documentId, actorId)
    ) WITHOUT ROWID;`,
    down: `
    DROP TABLE IF EXISTS Clock;
    `,
  },
]

export default migrations
