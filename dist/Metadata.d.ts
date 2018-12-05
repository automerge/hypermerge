import { Feed } from "./hypercore";
import { Clock } from "./Clock";
export interface MetadataBlock {
    id: string;
    docId?: string;
    bytes?: number;
    actorIds?: string[];
    follows?: string[];
    merge?: Clock;
}
export declare class Metadata {
    private primaryActors;
    private follows;
    private merges;
    private readyQ;
    private clocks;
    private writable;
    private ready;
    private replay;
    private ledger;
    constructor(ledger: Feed<MetadataBlock>);
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
    addActors(id: string, actorIds: string[]): void;
    forDoc(id: string): MetadataBlock;
    forActor(actor: string): MetadataBlock[];
}
