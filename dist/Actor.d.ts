/**
 * Actors provide an interface over the data replication scheme.
 * For dat, this means the actor abstracts over the hypercore and its peers.
 */
import { Feed, Peer } from "./hypercore";
import { Change } from "automerge/backend";
import * as Keys from "./Keys";
export declare type FeedHead = FeedHeadMetadata | Change;
export declare type FeedType = "Unknown" | "Automerge" | "File";
export declare type ActorMsg = ActorFeedReady | ActorInitialized | ActorSync | PeerUpdate | PeerAdd | Download;
interface FeedHeadMetadata {
    type: "File";
    bytes: number;
    mimeType: string;
    blockSize: number;
}
interface ActorSync {
    type: "ActorSync";
    actor: Actor;
}
interface ActorFeedReady {
    type: "ActorFeedReady";
    actor: Actor;
    writable: boolean;
}
interface ActorInitialized {
    type: "ActorInitialized";
    actor: Actor;
}
interface PeerUpdate {
    type: "PeerUpdate";
    actor: Actor;
    peers: number;
}
interface PeerAdd {
    type: "PeerAdd";
    actor: Actor;
    peer: Peer;
}
interface Download {
    type: "Download";
    actor: Actor;
    time: number;
    size: number;
    index: number;
}
interface ActorConfig {
    keys: Keys.KeyBuffer;
    notify: (msg: ActorMsg) => void;
    storage: (path: string) => Function;
}
export declare class Actor {
    id: string;
    dkString: string;
    changes: Change[];
    feed: Feed<Uint8Array>;
    peers: Map<string, Peer>;
    type: FeedType;
    private q;
    private notify;
    private storage;
    private data;
    private pending;
    private fileMetadata?;
    constructor(config: ActorConfig);
    onFeedReady: () => void;
    init: (rawBlocks: Uint8Array[]) => void;
    onReady: (cb: (actor: Actor) => void) => void;
    onPeerAdd: (peer: Peer) => void;
    onPeerRemove: (peer: Peer) => void;
    onDownload: (index: number, data: Uint8Array) => void;
    onSync: () => void;
    onClose: () => void;
    parseBlock: (data: Uint8Array, index: number) => void;
    parseHeaderBlock(data: Uint8Array): void;
    parseDataBlock(data: Uint8Array, index: number): void;
    writeChange(change: Change): void;
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
