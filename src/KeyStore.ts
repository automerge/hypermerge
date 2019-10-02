import { Database, Statement } from './SqlDatabase'
import * as Keys from './Keys'

interface KeyRow {
  name: string
  publicKey: Buffer
  secretKey: Buffer
}

export default class KeyStore {
  private db: Database
  private preparedGet: Statement<string>
  private preparedSet: Statement<[string, Buffer, Buffer?]>
  private preparedClear: Statement<string>

  constructor(db: Database) {
    this.db = db

    this.preparedGet = this.db.prepare(`SELECT * FROM Keys WHERE "name"=?`)
    this.preparedSet = this.db.prepare(`
        INSERT INTO Keys ("name", publicKey, secretKey) VALUES (?, ?, ?) 
        ON CONFLICT ("name") DO UPDATE SET publicKey=excluded.publicKey, secretKey=excluded.secretKey`)
    this.preparedClear = this.db.prepare(`DELETE FROM Keys WHERE "name"=?`)
  }

  get(name: string): Keys.KeyBuffer | undefined {
    const res: KeyRow | undefined = this.preparedGet.get(name)
    return res ? { publicKey: res.publicKey, secretKey: res.secretKey } : undefined
  }

  set(name: string, keyPair: Keys.KeyBuffer): Keys.KeyBuffer {
    this.preparedSet.run(name, keyPair.publicKey, keyPair.secretKey)
    return keyPair
  }

  clear(name: string) {
    this.preparedClear.run(name)
  }
}
