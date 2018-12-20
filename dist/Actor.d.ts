/// <reference types="node" />
import { RepoBackend, KeyBuffer } from "./RepoBackend";
import { Feed, Peer } from "./hypercore";
import { Change } from "automerge/backend";
import { Metadata } from "./Metadata";
import Queue from "./Queue";
export declare type ActorMsg = NewMetadata | ActorSync | PeerUpdate | Download;
export declare type FeedHead = FeedHeadMetadata | Change;
export declare type FeedType = "Unknown" | "Automerge" | "File";
interface FeedHeadMetadata {
    type: "File";
    bytes: number;
    mimeType: string;
}
interface NewMetadata {
    type: "NewMetadata";
    input: Uint8Array;
}
interface ActorSync {
    type: "ActorSync";
    actor: Actor;
}
interface PeerUpdate {
    type: "PeerUpdate";
    actor: Actor;
    peers: number;
}
interface Download {
    type: "Download";
    actor: Actor;
    time: number;
    size: number;
    index: number;
}
export declare const EXT = "hypermerge.2";
interface ActorConfig {
    keys: KeyBuffer;
    meta: Metadata;
    notify: (msg: ActorMsg) => void;
    storage: (path: string) => Function;
    repo: RepoBackend;
}
export declare class Actor {
    id: string;
    dkString: string;
    q: Queue<(actor: Actor) => void>;
    private syncQ;
    changes: Change[];
    feed: Feed<Uint8Array>;
    peers: Set<Peer>;
    meta: Metadata;
    notify: (msg: ActorMsg) => void;
    type: FeedType;
    data: Uint8Array[];
    fileMetadata?: FeedHeadMetadata;
    repo: RepoBackend;
    constructor(config: ActorConfig);
    message(message: any, target?: Peer): void;
    feedReady: () => void;
    handleFeedHead(head: any): void;
    init: (datas: Uint8Array[]) => void;
    peerRemove: (peer: Peer) => void;
    peerAdd: (peer: Peer) => void;
    close: () => void;
    sync: () => void;
    handleDownload: (index: number, data: Uint8Array) => void;
    handleBlock: (idx: number, data: Uint8Array) => void;
    push: (cb: (actor: Actor) => void) => void;
    writeFile(data: Uint8Array, mimeType: string): void;
    readFile(cb: (data: Buffer, mimeType: string) => void): void;
    append(block: Uint8Array, cb?: () => void): void;
    writeChange(change: Change): void;
}
export {};
