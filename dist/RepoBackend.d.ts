/// <reference types="node" />
import Queue from "./Queue";
import { Feed, Peer } from "./hypercore";
import { Clock, Change } from "automerge/backend";
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
export declare class RepoBackend {
    path?: string;
    storage: Function;
    joined: Set<Buffer>;
    feeds: Map<string, Feed<Uint8Array>>;
    feedQs: Map<string, Queue<FeedFn>>;
    feedPeers: Map<string, Set<Peer>>;
    docs: Map<string, DocBackend>;
    changes: Map<string, Change[]>;
    private meta;
    private opts;
    toFrontend: Queue<ToFrontendRepoMsg>;
    swarm?: Swarm;
    id: Buffer;
    constructor(opts: Options);
    private createDocBackend;
    private openDocBackend;
    merge(id: string, clock: Clock): void;
    follow(id: string, target: string): void;
    replicate: (swarm: Swarm) => void;
    private feedData;
    private allFeedData;
    writeChange(actorId: string, change: Change): void;
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
    private feedDocs;
    private initActors;
    private initFeed;
    private message;
    syncChanges(actor: string): void;
    stream: (opts: any) => any;
    releaseManager(doc: DocBackend): void;
    subscribe: (subscriber: (message: ToFrontendRepoMsg) => void) => void;
    receive: (msg: ToBackendRepoMsg) => void;
}
export {};
