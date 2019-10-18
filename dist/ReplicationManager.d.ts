import NetworkPeer from './NetworkPeer';
import FeedStore, { FeedId } from './FeedStore';
import { DiscoveryId } from './Misc';
import MessageRouter from './MessageRouter';
import MapSet from './MapSet';
import Queue from './Queue';
declare type ReplicationMsg = DiscoveryIdsMsg;
interface DiscoveryIdsMsg {
    type: 'DiscoveryIds';
    discoveryIds: DiscoveryId[];
}
export interface Discovery {
    feedId: FeedId;
    discoveryId: DiscoveryId;
    peer: NetworkPeer;
}
export default class ReplicationManager {
    private protocols;
    private feeds;
    messages: MessageRouter<ReplicationMsg>;
    replicating: MapSet<NetworkPeer, DiscoveryId>;
    discoveryQ: Queue<Discovery>;
    constructor(feeds: FeedStore);
    getPeersWith(discoveryIds: DiscoveryId[]): Set<NetworkPeer>;
    close(): void;
    /**
     * Call this when a peer connects.
     */
    onPeer: (peer: NetworkPeer) => void;
    private replicateWith;
    private onFeedCreated;
    private onMessage;
    private getOrCreateProtocol;
}
export {};
