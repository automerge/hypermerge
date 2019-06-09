/**
 * Actors provide an interface over the data replication scheme.
 * For dat, this means the actor abstracts over the hypercore and its peers.
 */
import { Feed, Peer } from "./hypercore";
import { Change } from "automerge";
import * as Keys from "./Keys";
export declare type FeedHead<T> = FeedHeadMetadata | Change<T>;
export declare type FeedType = "Unknown" | "Automerge" | "File";
export declare type ActorMsg<T> = ActorFeedReady<T> | ActorInitialized<T> | ActorSync<T> | PeerUpdate<T> | PeerAdd<T> | Download<T>;
interface FeedHeadMetadata {
    type: "File";
    bytes: number;
    mimeType: string;
    blockSize: number;
}
interface ActorSync<T> {
    type: "ActorSync";
    actor: Actor<T>;
}
interface ActorFeedReady<T> {
    type: "ActorFeedReady";
    actor: Actor<T>;
    writable: boolean;
}
interface ActorInitialized<T> {
    type: "ActorInitialized";
    actor: Actor<T>;
}
interface PeerUpdate<T> {
    type: "PeerUpdate";
    actor: Actor<T>;
    peers: number;
}
interface PeerAdd<T> {
    type: "PeerAdd";
    actor: Actor<T>;
    peer: Peer;
}
interface Download<T> {
    type: "Download";
    actor: Actor<T>;
    time: number;
    size: number;
    index: number;
}
interface ActorConfig<T> {
    keys: Keys.KeyBuffer;
    notify: (msg: ActorMsg<T>) => void;
    storage: (path: string) => Function;
}
export declare class Actor<T> {
    id: string;
    dkString: string;
    changes: Change<T>[];
    feed: Feed<Uint8Array>;
    peers: Set<Peer>;
    type: FeedType;
    private q;
    private notify;
    private storage;
    private data;
    private pending;
    private fileMetadata?;
    constructor(config: ActorConfig<T>);
    onFeedReady: () => void;
    init: (rawBlocks: Uint8Array[]) => void;
    onReady: (cb: (actor: Actor<T>) => void) => void;
    onPeerAdd: (peer: Peer) => void;
    onPeerRemove: (peer: Peer) => void;
    onDownload: (index: number, data: Uint8Array) => void;
    onSync: () => void;
    onClose: () => void;
    parseBlock: (data: Uint8Array, index: number) => void;
    parseHeaderBlock(data: Uint8Array): void;
    parseDataBlock(data: Uint8Array, index: number): void;
    writeChange(change: Change<T>): void;
    writeFile(data: Uint8Array, mimeType: string): void;
    readFile(): Promise<{
        body: Uint8Array;
        mimeType: string;
    }>;
    fileHead(): Promise<FeedHeadMetadata>;
    fileBody(head: FeedHeadMetadata): Promise<Uint8Array>;
    private append;
    close: () => void;
    destroy: () => void;
}
export {};
