/// <reference types="node" />
import Queue from "./Queue";
import { Clock } from "./Clock";
export declare function validateMetadataMsg(input: Uint8Array): MetadataBlock[];
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
    follows?: string[];
    merge?: Clock;
    deleted?: boolean;
}
export declare function isValidID(id: any): boolean;
export declare function validateURL(urlString: string): UrlInfo;
export declare function validateFileURL(urlString: string): string;
export declare function validateDocURL(urlString: string): string;
export declare class Metadata {
    private primaryActors;
    private follows;
    private files;
    private mimeTypes;
    private merges;
    readyQ: Queue<() => void>;
    private clocks;
    master: Clock;
    private writable;
    private ready;
    private replay;
    private ledger;
    id: Buffer;
    constructor(storageFn: Function);
    private loadLedger;
    private hasBlock;
    private batchAdd;
    private writeThrough;
    private append;
    private addBlock;
    setWritable(actor: string, writable: boolean): void;
    localActorId(id: string): string | undefined;
    actorsAsync(id: string, cb: (actors: string[]) => void): void;
    actors(id: string): string[];
    private actorsSeen;
    clock(id: string): Clock;
    private genClock;
    private genClocks;
    docsWith(actor: string, seq?: number): string[];
    covered(id: string, clock: Clock): Clock;
    docs(): string[];
    has(id: string, actor: string, seq: number): boolean;
    merge(id: string, merge: Clock): void;
    follow(id: string, follow: string): void;
    addFile(id: string, bytes: number, mimeType: string): void;
    delete(id: string): void;
    addActor(id: string, actorId: string): void;
    addBlocks(blocks: MetadataBlock[]): void;
    addActors(id: string, actors: string[]): void;
    isFile(id: string): boolean;
    isKnown(id: string): boolean;
    isDoc(id: string): boolean;
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
    follows: string[];
};
export declare type PublicFileMetadata = {
    type: "File";
    bytes: number;
    mimeType: string;
};
