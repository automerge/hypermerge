import { DiscoveryId } from './Misc';
import NetworkPeer, { PeerId } from './NetworkPeer';
import { Swarm, JoinOptions } from './SwarmInterface';
import Queue from './Queue';
export default class Network {
    selfId: PeerId;
    joined: Set<DiscoveryId>;
    pending: Set<DiscoveryId>;
    peers: Map<PeerId, NetworkPeer>;
    peerQ: Queue<NetworkPeer>;
    swarm?: Swarm;
    joinOptions?: JoinOptions;
    constructor(selfId: PeerId);
    join(discoveryId: DiscoveryId): void;
    leave(discoveryId: DiscoveryId): void;
    setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void;
    readonly closedConnectionCount: number;
    close(): Promise<void>;
    getOrCreatePeer(peerId: PeerId): NetworkPeer;
    private onConnection;
}
