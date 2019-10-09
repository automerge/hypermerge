import NetworkPeer from './NetworkPeer';
import FeedStore, { FeedId } from './FeedStore';
import { DiscoveryId } from './Misc';
import Queue from './Queue';
export interface Discovery {
    feedId: FeedId;
    discoveryId: DiscoveryId;
    peer: NetworkPeer;
}
export default class ReplicationManager {
    private discoveryIds;
    private messages;
    private peers;
    private peersByDiscoveryId;
    private protocols;
    private feeds;
    discoveryQ: Queue<Discovery>;
    constructor(feeds: FeedStore);
    addFeedIds(feedIds: FeedId[]): void;
    getFeedId(discoveryId: DiscoveryId): FeedId | undefined;
    getPeersWith(discoveryIds: DiscoveryId[]): Set<NetworkPeer>;
    close(): void;
    /**
     * Should be called when a peer connects.
     */
    onPeer: (peer: NetworkPeer) => void;
    private replicateWith;
    private onMessage;
    private getOrCreateProtocol;
}
