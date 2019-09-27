/// <reference types="better-sqlite3" />
import { DocId } from './Misc';
import { Clock } from './Clock';
import { Database } from './SqlDatabase';
export interface ClockMap {
    [documentId: string]: Clock;
}
export declare type ClockUpdate = [DocId, Clock];
export default class ClockStore {
    db: Database;
    private preparedGet;
    private preparedInsert;
    private preparedDelete;
    constructor(db: Database);
    /**
     * TODO: handle missing clocks better. Currently returns an empty clock (i.e. an empty object)
     */
    get(documentId: DocId): Clock;
    /**
     * Retrieve the clocks for all given documents. If we don't have a clock
     * for a document, the resulting ClockMap won't have an entry for that document id.
     */
    getMultiple(documentIds: DocId[]): ClockMap;
    /**
     * Update an existing clock with a new clock, merging the two.
     * If no clock exists in the data store, the new clock is stored as-is.
     */
    update(documentId: DocId, clock: Clock): ClockUpdate;
    /**
     * Hard set of a clock. Will clear any clock values that exist for the given document id
     * and set explicitly the passed in clock.
     */
    set(documentId: DocId, clock: Clock): ClockUpdate;
}
