import sqlite from 'sqlite';
import { SQLStatement } from 'sql-template-strings';
export { default as SQL } from 'sql-template-strings';
export declare const IN_MEMORY_DB = ":memory:";
export default class SQLStore {
    private dbPromise;
    constructor(storage: string);
    get(sql: SQLStatement): Promise<any>;
    run(sql: SQLStatement): Promise<sqlite.Statement>;
    all(sql: SQLStatement): Promise<any[]>;
    close(): Promise<void>;
}
export declare function joinStatements(statements: SQLStatement[], delimiter: string): SQLStatement;
