/// <reference types="node" />
import { KeyBuffer } from "./RepoBackend";
import { Feed, Peer } from "./hypercore";
import { Change } from "automerge/backend";
import { Metadata } from "./Metadata";
import Queue from "./Queue";
export declare type ActorMsg = NewMetadata | ActorSync;
export declare type FeedHead = FileMetadata | Change;
export declare type FeedType = "Unknown" | "Automerge" | "File";
interface FileMetadata {
    type: "File";
    bytes: number;
}
interface NewMetadata {
    type: "NewMetadata";
    input: Uint8Array;
}
interface ActorSync {
    type: "ActorSync";
    actor: Actor;
}
export declare const EXT = "hypermerge.2";
interface ActorConfig {
    keys: KeyBuffer;
    meta: Metadata;
    notify: (msg: ActorMsg) => void;
    storage: (path: string) => Function;
}
export declare class Actor {
    id: string;
    dkString: string;
    q: Queue<(actor: Actor) => void>;
    syncQ: Queue<() => void>;
    changes: Change[];
    feed: Feed<Uint8Array>;
    peers: Set<Peer>;
    meta: Metadata;
    notify: (msg: ActorMsg) => void;
    type: FeedType;
    data: Uint8Array[];
    fileMetadata?: FileMetadata;
    constructor(config: ActorConfig);
    message(message: any, target?: Peer): void;
    feedReady: () => void;
    handleFeedHead(head: any): void;
    init: (datas: Uint8Array[]) => void;
    peerRemove: (peer: Peer) => void;
    peerAdd: (peer: Peer) => void;
    close: () => void;
    sync: () => void;
    handleBlock: (idx: number, data: Uint8Array) => void;
    push: (cb: (actor: Actor) => void) => void;
    writeFile(data: Uint8Array): void;
    readFile(cb: (data: Buffer) => void): void;
    append(block: Uint8Array): void;
    writeChange(change: Change): void;
}
export {};
