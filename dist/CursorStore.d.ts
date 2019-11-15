/// <reference types="better-sqlite3" />
import { RepoId, DocId, ActorId } from './Misc';
import * as Clock from './Clock';
import { Database } from './SqlDatabase';
import Queue from './Queue';
export declare type Cursor = Clock.Clock;
export declare type CursorEntry = [ActorId, number];
export declare type CursorDescriptor = [Cursor, DocId, RepoId];
export declare const INFINITY_SEQ: number;
export default class CursorStore {
    private db;
    private preparedGet;
    private preparedInsert;
    private preparedEntry;
    private preparedDocsWithActor;
    private preparedAllDocumentIds;
    updateQ: Queue<CursorDescriptor>;
    constructor(db: Database);
    get(repoId: RepoId, docId: DocId): Cursor;
    update(repoId: RepoId, docId: DocId, cursor: Cursor): CursorDescriptor;
    entry(repoId: RepoId, docId: DocId, actorId: ActorId): number;
    docsWithActor(repoId: RepoId, actorId: ActorId, seq?: number): DocId[];
    addActor(repoId: RepoId, docId: DocId, actorId: ActorId, seq?: number): CursorDescriptor;
    getAllDocumentIds(repoId: RepoId): DocId[];
}
