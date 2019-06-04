/// <reference types="node" />
import Queue from "./Queue";
import { Clock } from "./Clock";
export interface NewMetadata {
    type: "NewMetadata";
    input: Uint8Array;
}
export declare function validateRemoteMetadata(message: RemoteMetadata): RemoteMetadata;
export declare function cleanMetadataInput(input: any): MetadataBlock | undefined;
export declare function filterMetadataInputs(input: any[]): MetadataBlock[];
export interface UrlInfo {
    id: string;
    buffer: Buffer;
    type: string;
}
export interface MetadataBlock {
    id: string;
    bytes?: number;
    mimeType?: string;
    actors?: string[];
    merge?: Clock;
    deleted?: boolean;
}
export declare function isValidID(id: any): boolean;
export declare function validateURL(urlString: string): UrlInfo;
export declare function validateFileURL(urlString: string): string;
export declare function validateDocURL(urlString: string): string;
export interface RemoteMetadata {
    type: "RemoteMetadata";
    clocks: {
        [id: string]: Clock;
    };
    blocks: MetadataBlock[];
}
export declare class Metadata {
    docs: Set<string>;
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
    constructor(storageFn: Function, joinFn: (id: string) => void, leaveFn: (id: string) => void);
    private loadLedger;
    private hasBlock;
    private batchAdd;
    private writeThrough;
    private append;
    private addBlock;
    allActors(): Set<string>;
    setWritable(actor: string, writable: boolean): void;
    localActorId(id: string): string | undefined;
    actorsAsync(id: string): Promise<string[]>;
    actors(id: string): string[];
    clockAt(id: string, actor: string): number;
    clock(id: string): Clock;
    docsWith(actor: string, seq?: number): string[];
    has(id: string, actor: string, seq: number): boolean;
    merge(id: string, merge: Clock): void;
    addFile(id: string, bytes: number, mimeType: string): void;
    delete(id: string): void;
    addActor(id: string, actorId: string): void;
    addBlocks(blocks: MetadataBlock[]): void;
    addActors(id: string, actors: string[]): void;
    isFile(id: string): boolean;
    isKnown(id: string): boolean;
    isDoc(id: string): boolean;
    bench(msg: string, f: () => void): void;
    publicMetadata(id: string, cb: (meta: PublicMetadata | null) => void): void;
    forDoc(id: string): MetadataBlock;
    forActor(actor: string): MetadataBlock[];
}
export declare type PublicMetadata = PublicDocMetadata | PublicFileMetadata;
export declare type PublicDocMetadata = {
    type: "Document";
    clock: Clock;
    history: number;
    actor: string | undefined;
    actors: string[];
};
export declare type PublicFileMetadata = {
    type: "File";
    bytes: number;
    mimeType: string;
};
