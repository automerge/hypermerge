import { DocId } from './Misc'
import SQLStore, { SQL, joinStatements } from './SQLStore'
import { Clock, union } from './Clock'
import Queue from './Queue'

export interface ClockMap {
  [documentId: string /*DocId*/]: Clock
}

interface Row {
  documentId: string
  clock: string
}

export type ClockUpdate = [DocId, Clock]

// Note: We store clocks as serialized JSON. This has several downsides compared to a more
// traditional m2m schema, but has the upside of allowing us to easily set the entire
// clock.
export default class ClockStore {
  updateLog: Queue<ClockUpdate> = new Queue()
  private store: SQLStore
  constructor(store: SQLStore) {
    this.store = store
  }

  async get(documentId: DocId): Promise<Clock | undefined> {
    const result: Row = await this.store.get(
      SQL`SELECT clock FROM DocumentClock WHERE documentId=${documentId}`
    )
    return result ? parseClock(result.clock) : undefined
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

  async set(documentId: DocId, clock: Clock): Promise<ClockUpdate> {
    const clockValue = serializeClock(clock)
    const sql = SQL`INSERT INTO DocumentClock (documentId, clock) VALUES (${documentId}, ${clockValue}) ON CONFLICT (documentId) DO UPDATE SET clock=excluded.clock`
    await this.store.run(sql)
    const update: ClockUpdate = [documentId, clock]
    this.updateLog.push(update)
    return update
  }

  // If using the more normalized schema, we can use ON CONFLICT UPDATE to only update the row
  // if the new clock value is greater than the old clock value. This avoids the traditional
  // read-write cycle.
  async merge(documentId: DocId, clock: Clock): Promise<ClockUpdate> {
    const existingClock = await this.get(documentId)
    if (!existingClock) {
      return this.set(documentId, clock)
    }

    const mergedClock = union(existingClock, clock)
    return this.set(documentId, mergedClock)
  }
}

function serializeClock(clock: Clock) {
  return JSON.stringify(clock)
}

function parseClock(clockVal: string) {
  return JSON.parse(clockVal)
}
