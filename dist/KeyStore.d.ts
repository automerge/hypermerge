/// <reference types="better-sqlite3" />
import { Database } from './SqlDatabase';
import * as Keys from './Keys';
export default class KeyStore {
    private db;
    private preparedGet;
    private preparedSet;
    private preparedClear;
    constructor(db: Database);
    get(name: string): Keys.KeyBuffer | undefined;
    set(name: string, keyPair: Keys.KeyBuffer): Keys.KeyBuffer;
    clear(name: string): void;
}
