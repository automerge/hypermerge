/// <reference types="node" />
import { DiscoveryId } from './Misc';
import Peer, { PeerId } from './NetworkPeer';
import FeedStore, { FeedId } from './FeedStore';
export interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
    removeAllListeners(): void;
    discovery: {
        removeAllListeners(): void;
        close(): void;
    };
    peers: Map<any, any>;
}
export default class Network {
    selfId: PeerId;
    joined: Map<DiscoveryId, FeedId>;
    store: FeedStore;
    peers: Map<PeerId, Peer>;
    swarm?: Swarm;
    constructor(selfId: PeerId, store: FeedStore);
    join(feedId: FeedId): void;
    leave(feedId: FeedId): void;
    setSwarm(swarm: Swarm): void;
    close(): Promise<void>;
    onConnect: (peerInfo: any) => any;
}
