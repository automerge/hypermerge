import { DocId } from './Misc'
import SQLStore, { SQL } from './SQLStore'

export interface Clock {
  [feedId: string /*FeedId*/]: number
}

interface ClockRow {
  documentId: string
  feedId: string
  clockValue: number
}

// Note: We store clocks as serialized JSON. This has several downsides compared to a more
// traditional m2m schema, but has the upside of allowing us to easily set the entire
//
export default class ClockStore {
  store: SQLStore
  table = 'DocumentClock'
  constructor(store: SQLStore) {
    this.store = store
  }

  async get(documentId: DocId): Promise<Clock> {
    const result = await this.store.get(
      SQL`SELECT clock FROM DocumentClock WHERE documentId=${documentId}`
    )
    return JSON.parse(result.clock)
  }

  async set(documentId: DocId, clock: Clock): Promise<[DocId, Clock]> {
    const clockValue = JSON.stringify(clock)
    const sql = SQL`INSERT INTO DocumentClock (documentId, clock) VALUES (${documentId}, ${clockValue}) ON CONFLICT (documentId) DO UPDATE SET clock=excluded.clock`
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
