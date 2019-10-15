/// <reference types="better-sqlite3" />
import { RepoId, DocId } from './Misc';
import { Clock } from './Clock';
import { Database } from './SqlDatabase';
import Queue from './Queue';
export interface ClockMap {
    [documentId: string]: Clock;
}
export declare type ClockUpdate = [RepoId, DocId, Clock];
export default class ClockStore {
    db: Database;
    updateQ: Queue<ClockUpdate>;
    private preparedGet;
    private preparedInsert;
    private preparedDelete;
    private preparedAllRepoIds;
    private preparedAllDocumentIds;
    constructor(db: Database);
    /**
     * TODO: handle missing clocks better. Currently returns an empty clock (i.e. an empty object)
     */
    get(repoId: RepoId, documentId: DocId): Clock;
    /**
     * Retrieve the clocks for all given documents. If we don't have a clock
     * for a document, the resulting ClockMap won't have an entry for that document id.
     */
    getMultiple(repoId: RepoId, documentIds: DocId[]): ClockMap;
    /**
     * Update an existing clock with a new clock, merging the two.
     * If no clock exists in the data store, the new clock is stored as-is.
     */
    update(repoId: RepoId, documentId: DocId, clock: Clock): ClockUpdate;
    /**
     * Hard set of a clock. Will clear any clock values that exist for the given document id
     * and set explicitly the passed in clock.
     */
    set(repoId: RepoId, documentId: DocId, clock: Clock): ClockUpdate;
    getAllDocumentIds(repoId: RepoId): DocId[];
    getAllRepoIds(): RepoId[];
}
