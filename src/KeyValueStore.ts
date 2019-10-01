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

    this.preparedGet = this.db.prepare(`SELECT val FROM KeyValue WHERE key=?`)
    this.preparedSet = this.db.prepare(`
        INSERT INTO KeyValue (key, val) VALUES (?, ?) 
        ON CONFLICT (key) DO UPDATE SET val=excluded.val`)
    this.preparedClear = this.db.prepare(`DELETE FROM KeyValue WHERE key=?`)
  }

  get(key: string) {
    const res = this.preparedGet.get(key)
    return res.val
  }

  set(key: string, value: string) {
    this.preparedSet.run(key, value)
  }

  clear(key: string) {
    this.preparedClear.run(key)
  }
}
