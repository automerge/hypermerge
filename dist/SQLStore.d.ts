import sqlite3 from 'better-sqlite3';
export declare const IN_MEMORY_DB = ":memory:";
export default class SQLStore {
    db: sqlite3.Database;
    constructor(storage: string);
    migrate(): void;
    close(): void;
}
