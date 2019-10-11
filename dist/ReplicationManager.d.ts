import NetworkPeer from './NetworkPeer';
import FeedStore, { FeedId } from './FeedStore';
import { DiscoveryId } from './Misc';
import MessageCenter from './MessageCenter';
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
    discoveryIds: Map<DiscoveryId, FeedId>;
    messages: MessageCenter<ReplicationMsg>;
    peers: Set<NetworkPeer>;
    peersByDiscoveryId: MapSet<DiscoveryId, NetworkPeer>;
    discoveryQ: Queue<Discovery>;
    constructor(feeds: FeedStore);
    addFeedIds(feedIds: FeedId[]): void;
    getFeedId(discoveryId: DiscoveryId): FeedId | undefined;
    getPeersWith(discoveryIds: DiscoveryId[]): Set<NetworkPeer>;
    close(): void;
    /**
     * Call this when a peer connects.
     */
    onPeer: (peer: NetworkPeer) => void;
    private replicateWith;
    private onMessage;
    private getOrCreateProtocol;
}
export {};
