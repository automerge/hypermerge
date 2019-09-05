/**
 * Actors provide an interface over the data replication scheme.
 * For dat, this means the actor abstracts over the hypercore and its peers.
 */
import { Peer } from './hypercore';
import { Change } from 'automerge/backend';
import { ActorId, DiscoveryId } from './Misc';
import * as Keys from './Keys';
import FeedStore, { FeedId } from './FeedStore';
export declare type ActorMsg = ActorFeedReady | ActorInitialized | ActorSync | PeerUpdate | PeerAdd | Download;
interface ActorSync {
    type: 'ActorSync';
    actor: Actor;
}
interface ActorFeedReady {
    type: 'ActorFeedReady';
    actor: Actor;
    writable: boolean;
}
interface ActorInitialized {
    type: 'ActorInitialized';
    actor: Actor;
}
interface PeerUpdate {
    type: 'PeerUpdate';
    actor: Actor;
    peers: number;
}
interface PeerAdd {
    type: 'PeerAdd';
    actor: Actor;
    peer: Peer;
}
interface Download {
    type: 'Download';
    actor: Actor;
    time: number;
    size: number;
    index: number;
}
interface ActorConfig {
    keys: Keys.KeyBuffer;
    notify: (msg: ActorMsg) => void;
    store: FeedStore;
}
export declare class Actor {
    id: ActorId;
    dkString: DiscoveryId;
    changes: Change[];
    peers: Map<string, Peer>;
    private q;
    private notify;
    private store;
    constructor(config: ActorConfig);
    getOrCreateFeed: (keys: Keys.KeyPair) => Promise<import("./hypercore").Feed<Uint8Array>>;
    onFeedReady: (feed: import("./hypercore").Feed<Uint8Array>) => Promise<void>;
    onReady: (cb: (actor: Actor) => void) => void;
    onPeerAdd: (peer: Peer) => void;
    onPeerRemove: (peer: Peer) => void;
    onDownload: (index: number, data: Uint8Array) => void;
    onSync: () => void;
    onClose: () => void;
    parseBlock: (data: Uint8Array, index: number) => void;
    writeChange(change: Change): void;
    close: () => Promise<FeedId>;
    destroy: () => Promise<void>;
}
export {};
