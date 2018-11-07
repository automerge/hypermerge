/// <reference types="node" />
export declare const EXT = "hypermerge";
declare type FeedFn = (f: Feed<Uint8Array>) => void;
interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
}
import Queue from "./Queue";
import { Feed, Peer } from "./hypercore";
import { Change } from "automerge/backend";
import { DocumentBackend } from "./DocumentBackend";
import { Document } from "./Document";
export declare function keyPair(docId?: string): Keys;
export interface KeyBuffer {
    publicKey: Buffer;
    secretKey?: Buffer;
}
export interface Keys {
    publicKey: Buffer;
    secretKey?: Buffer;
    docId: string;
    actorId?: string;
}
export interface FeedData {
    actorId: string;
    writable: Boolean;
    changes: Change[];
}
export interface Options {
    path?: string;
    storage?: Function;
}
export interface LedgerData {
    docId: string;
    actorIds: string[];
}
export declare class Repo {
    path?: string;
    storage: Function;
    ready: Promise<undefined>;
    joined: Set<Buffer>;
    feeds: Map<string, Feed<Uint8Array>>;
    feedQs: Map<string, Queue<FeedFn>>;
    feedPeers: Map<string, Set<Peer>>;
    docs: Map<string, DocumentBackend>;
    feedSeq: Map<string, number>;
    ledger: Feed<LedgerData>;
    private ledgerMetadata;
    private docMetadata;
    private opts;
    swarm?: Swarm;
    id: Buffer;
    constructor(opts?: Options);
    createDocument<T>(keys?: KeyBuffer): Document<T>;
    createDocumentBackend(keys?: KeyBuffer): DocumentBackend;
    private addMetadata;
    openDocumentBackend(docId: string): DocumentBackend;
    openDocument<T>(docId: string): Document<T>;
    joinSwarm(swarm: Swarm): void;
    private feedData;
    private allFeedData;
    writeChange(doc: DocumentBackend, actorId: string, change: Change): void;
    private loadDocument;
    private join;
    private leave;
    private getFeed;
    private storageFn;
    initActorFeed(doc: DocumentBackend): string;
    sendToPeer(peer: Peer, data: any): void;
    actorIds(doc: DocumentBackend): string[];
    feed(actorId: string): Feed<Uint8Array>;
    peers(doc: DocumentBackend): Peer[];
    private closeFeed;
    private initFeed;
    stream: (opts: any) => any;
    releaseManager(doc: DocumentBackend): void;
}
export {};
