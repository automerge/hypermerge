/// <reference types="node" />
import Queue from "./Queue";
import { Feed, Peer } from "./hypercore";
import { Change } from "automerge/backend";
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { DocBackend } from "./DocBackend";
export declare const EXT = "hypermerge";
declare type FeedFn = (f: Feed<Uint8Array>) => void;
interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
}
export interface KeyBuffer {
    publicKey: Buffer;
    secretKey?: Buffer;
}
export interface FeedData {
    actorId: string;
    writable: Boolean;
    changes: Change[];
}
export interface Options {
    path?: string;
    storage: Function;
}
export interface LedgerData {
    docId: string;
    actorIds: string[];
}
export declare class RepoBackend {
    path?: string;
    storage: Function;
    ready: Promise<undefined>;
    joined: Set<Buffer>;
    feeds: Map<string, Feed<Uint8Array>>;
    feedQs: Map<string, Queue<FeedFn>>;
    feedPeers: Map<string, Set<Peer>>;
    docs: Map<string, DocBackend>;
    feedSeq: Map<string, number>;
    ledger: Feed<LedgerData>;
    private ledgerMetadata;
    private docMetadata;
    private opts;
    toFrontend: Queue<ToFrontendRepoMsg>;
    swarm?: Swarm;
    id: Buffer;
    constructor(opts: Options);
    private createDocBackend;
    private addMetadata;
    private openDocBackend;
    replicate(swarm: Swarm): void;
    private feedData;
    private allFeedData;
    writeChange(doc: DocBackend, actorId: string, change: Change): void;
    private loadDocument;
    private join;
    private leave;
    private getFeed;
    private storageFn;
    initActorFeed(doc: DocBackend): string;
    sendToPeer(peer: Peer, data: any): void;
    actorIds(doc: DocBackend): string[];
    feed(actorId: string): Feed<Uint8Array>;
    peers(doc: DocBackend): Peer[];
    private closeFeed;
    private initFeed;
    stream: (opts: any) => any;
    releaseManager(doc: DocBackend): void;
    subscribe: (subscriber: (message: ToFrontendRepoMsg) => void) => void;
    receive: (msg: ToBackendRepoMsg) => void;
}
export {};
