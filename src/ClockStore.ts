import { DocId } from './Misc'
import SQLStore, { SQL, joinStatements } from './SQLStore'

export interface Clock {
  [feedId: string /*FeedId*/]: number
}

export interface ClockMap {
  [documentId: string /*DocId*/]: Clock
}

interface Row {
  documentId: string
  clock: string
}

// Note: We store clocks as serialized JSON. This has several downsides compared to a more
// traditional m2m schema, but has the upside of allowing us to easily set the entire
// clock.
export default class ClockStore {
  store: SQLStore
  constructor(store: SQLStore) {
    this.store = store
  }

  async get(documentId: DocId): Promise<Clock> {
    const result: Row = await this.store.get(
      SQL`SELECT clock FROM DocumentClock WHERE documentId=${documentId}`
    )
    return parseClock(result.clock)
  }

  async getMultiple(documentIds: DocId[]): Promise<ClockMap> {
    const query = SQL`SELECT * FROM DocumentClock WHERE documentId IN (`
    query.append(joinStatements(documentIds.map((docId) => SQL`${docId}`), ', '))
    query.append(SQL`)`)

    const result: Row[] = await this.store.all(query)
    return result.reduce((clockMap: ClockMap, row: Row) => {
      clockMap[row.documentId] = parseClock(row.clock)
      return clockMap
    }, {})
  }

  async set(documentId: DocId, clock: Clock): Promise<[DocId, Clock]> {
    const clockValue = serializeClock(clock)
    const sql = SQL`INSERT INTO DocumentClock (documentId, clock) VALUES (${documentId}, ${clockValue}) ON CONFLICT (documentId) DO UPDATE SET clock=excluded.clock`
    await this.store.run(sql)
    return [documentId, clock]
  }
}

function serializeClock(clock: Clock) {
  return JSON.stringify(clock)
}

function parseClock(clockVal: string) {
  return JSON.parse(clockVal)
}
