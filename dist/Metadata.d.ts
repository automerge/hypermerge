/// <reference types="node" />
import Queue from "./Queue";
import { Clock } from "./Clock";
export declare function validateMetadataMsg(input: Uint8Array): MetadataBlock[];
export declare function cleanMetadataInput(input: any): MetadataBlock | undefined;
export declare function filterMetadataInputs(input: any[]): MetadataBlock[];
export interface MetadataBlock {
    id: string;
    bytes?: number;
    actors?: string[];
    follows?: string[];
    merge?: Clock;
}
export declare function isValidID(id: any): boolean;
export declare function validateID(id: string): void;
export declare class Metadata {
    private primaryActors;
    private follows;
    private merges;
    readyQ: Queue<() => void>;
    private clocks;
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
    addFile(id: string, bytes: number): void;
    addActor(id: string, actorId: string): void;
    addBlocks(blocks: MetadataBlock[]): void;
    addActors(id: string, actors: string[]): void;
    forDoc(id: string): MetadataBlock;
    forActor(actor: string): MetadataBlock[];
}
