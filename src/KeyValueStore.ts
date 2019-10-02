import { Database, Statement } from './SqlDatabase'

interface KeyValueRow {
  key: string
  val: string
}

export default class KeyValueStore {
  private db: Database
  private preparedGet: Statement<string>
  private preparedSet: Statement<[string, string]>
  private preparedClear: Statement<string>

  constructor(db: Database) {
    this.db = db

    this.preparedGet = this.db.prepare(`SELECT v FROM KeyValue WHERE k=?`)
    this.preparedSet = this.db.prepare(`
        INSERT INTO KeyValue (k, v) VALUES (?, ?) 
        ON CONFLICT (k) DO UPDATE SET v=excluded.v`)
    this.preparedClear = this.db.prepare(`DELETE FROM KeyValue WHERE k=?`)
  }

  get(key: string): string | undefined {
    return this.preparedGet.pluck(true).get(key)
  }

  set(key: string, value: string) {
    this.preparedSet.run(key, value)
  }

  clear(key: string) {
    this.preparedClear.run(key)
  }
}
