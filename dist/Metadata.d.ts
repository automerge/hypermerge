/// <reference types="node" />
import Queue from './Queue';
import { Clock } from './Clock';
import { DocUrl, DocId, ActorId, BaseUrl, BaseId, HyperfileId, HyperfileUrl } from './Misc';
export declare function sanitizeRemoteMetadata(message: any): RemoteMetadata;
export declare function cleanMetadataInput(input: any): MetadataBlock | undefined;
export declare function filterMetadataInputs(input: any[]): MetadataBlock[];
export interface UrlInfo {
    id: BaseId;
    buffer: Buffer;
    type: string;
}
interface ActorsBlock {
    id: DocId;
    actors: ActorId[];
}
interface MergeBlock {
    id: DocId;
    merge: Clock;
}
interface DeletedBlock {
    id: DocId;
    deleted: true;
}
interface FileBlock {
    id: HyperfileId;
    bytes: number;
    mimeType: string;
}
export declare type MetadataBlock = FileBlock | ActorsBlock | MergeBlock | DeletedBlock;
export declare function isValidID(id: BaseId): id is BaseId;
export declare function validateURL(urlString: BaseUrl | BaseId): UrlInfo;
export declare function validateFileURL(urlString: HyperfileUrl | HyperfileId): HyperfileId;
export declare function validateDocURL(urlString: DocUrl | DocId): DocId;
export interface RemoteMetadata {
    type: 'RemoteMetadata';
    clocks: {
        [docId: string]: Clock;
    };
    blocks: MetadataBlock[];
}
export declare class Metadata {
    docs: Set<DocId>;
    private primaryActors;
    private files;
    private mimeTypes;
    private merges;
    readyQ: Queue<() => void>;
    private _clocks;
    private _docsWith;
    private writable;
    private ready;
    private replay;
    private ledger;
    id: Buffer;
    private join;
    private leave;
    constructor(storageFn: Function, joinFn: (id: ActorId) => void, leaveFn: (id: ActorId) => void);
    private loadLedger;
    private hasBlock;
    private batchAdd;
    private writeThrough;
    private append;
    private addBlock;
    allActors(): Set<string>;
    setWritable(actor: ActorId, writable: boolean): void;
    localActorId(id: DocId): ActorId | undefined;
    actorsAsync(id: DocId): Promise<ActorId[]>;
    actors(id: DocId): ActorId[];
    clockAt(id: DocId, actor: ActorId): number;
    clock(id: DocId): Clock;
    docsWith(actor: ActorId, seq?: number): DocId[];
    has(id: DocId, actor: ActorId, seq: number): boolean;
    merge(id: DocId, merge: Clock): void;
    addFile(hyperfileUrl: HyperfileUrl, bytes: number, mimeType: string): void;
    delete(id: DocId): void;
    addActor(id: DocId, actorId: ActorId): void;
    addBlocks(blocks: MetadataBlock[]): void;
    addActors(id: DocId, actors: ActorId[]): void;
    isFile(id: HyperfileId | DocId): id is HyperfileId;
    isKnown(id: DocId | HyperfileId): boolean;
    isDoc(id: DocId | HyperfileId): id is DocId;
    bench(msg: string, f: () => void): void;
    publicMetadata(id: DocId | HyperfileId, cb: (meta: PublicMetadata | null) => void): void;
    forDoc(id: DocId): ActorsBlock & MergeBlock;
    forActor(actor: ActorId): MetadataBlock[];
}
export declare type PublicMetadata = PublicDocMetadata | PublicFileMetadata;
export declare type PublicDocMetadata = {
    type: 'Document';
    clock: Clock;
    history: number;
    actor: ActorId | undefined;
    actors: ActorId[];
};
export declare type PublicFileMetadata = {
    type: 'File';
    bytes: number;
    mimeType: string;
};
export {};
