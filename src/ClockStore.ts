import { DocId } from './Misc'
import SQLStore, { SQL, joinStatements } from './SQLStore'

export interface Clock {
  [feedId: string /*FeedId*/]: number
}

interface ClockRow {
  documentId: string
  feedId: string
  clockValue: number
}

export default class ClockStore {
  store: SQLStore
  table = 'DocumentClock'
  constructor(store: SQLStore) {
    this.store = store
  }

  async get(documentId: DocId): Promise<Clock> {
    const clockRows = await this.store.all(
      SQL`SELECT * FROM DocumentClock WHERE documentId=${documentId}`
    )
    return rowsToClock(clockRows)
  }
  async set(documentId: DocId, clock: Clock): Promise<[DocId, Clock]> {
    const sql = SQL`INSERT INTO DocumentClock (documentId, feedId, clockValue) VALUES `
    const valueStatements = Object.entries(clock).map(
      ([feedId, clockValue]) => SQL`(${documentId}, ${feedId}, ${clockValue})`
    )
    sql.append(joinStatements(valueStatements, ', '))
    sql.append(SQL`ON CONFLICT(documentId, feedId) DO UPDATE SET clockValue=excluded.clockValue`)
    await this.store.run(sql)
    return [documentId, clock]
  }
}

function rowsToClock(rows: ClockRow[]): Clock {
  return rows.reduce((clock: Clock, row: ClockRow) => {
    clock[row.feedId] = row.clockValue
    return clock
  }, {})
}
