import { RepoBackend, KeyBuffer } from "./RepoBackend";
import { Feed, Peer } from "./hypercore";
import { Change } from "automerge/backend";
import { Metadata, MetadataBlock, RemoteMetadata } from "./Metadata";
import { Clock } from "./Clock";
import Queue from "./Queue";
export declare type ActorMsg = RemoteMetadata | NewMetadata | ActorSync | PeerUpdate | Download;
export declare type FeedHead = FeedHeadMetadata | Change;
export declare type FeedType = "Unknown" | "Automerge" | "File";
interface FeedHeadMetadata {
    type: "File";
    bytes: number;
    mimeType: string;
    blockSize: number;
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
export declare const EXT2 = "hypermerge.3";
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
    storage: any;
    type: FeedType;
    data: Uint8Array[];
    pending: Uint8Array[];
    fileMetadata?: FeedHeadMetadata;
    repo: RepoBackend;
    constructor(config: ActorConfig);
    message2(blocks: MetadataBlock[], clocks: {
        [id: string]: Clock;
    }, target?: Peer): void;
    feedReady: () => void;
    handleFeedHead(data: Uint8Array): void;
    init: (datas: Uint8Array[]) => void;
    close: () => void;
    destroy: () => void;
    peerRemove: (peer: Peer) => void;
    peerAdd: (peer: Peer) => void;
    allClocks(): {
        [id: string]: Clock;
    };
    sync: () => void;
    handleDownload: (index: number, data: Uint8Array) => void;
    handleBlock: (data: Uint8Array, idx: number) => void;
    push: (cb: (actor: Actor) => void) => void;
    writeFile(data: Uint8Array, mimeType: string): void;
    fileHead(cb: (head: FeedHeadMetadata) => void): void;
    fileBody(head: FeedHeadMetadata, cb: (body: Uint8Array) => void): void;
    readFile(cb: (data: Uint8Array, mimeType: string) => void): void;
    append(block: Uint8Array, cb?: () => void): void;
    writeChange(change: Change): void;
}
export {};
