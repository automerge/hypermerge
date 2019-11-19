import { DiscoveryId } from './Misc';
import NetworkPeer, { PeerId } from './NetworkPeer';
import { Swarm, JoinOptions } from './SwarmInterface';
import Queue from './Queue';
export default class Network {
    selfId: PeerId;
    joined: Set<DiscoveryId>;
    peers: Map<PeerId, NetworkPeer>;
    peerQ: Queue<NetworkPeer>;
    discovered: Set<string>;
    swarms: Map<Swarm, JoinOptions>;
    constructor(selfId: PeerId);
    join(discoveryId: DiscoveryId): void;
    leave(discoveryId: DiscoveryId): void;
    /** @deprecated */
    get swarm(): Swarm | undefined;
    /**
     * @deprecated Use `addSwarm`
     */
    setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void;
    addSwarm(swarm: Swarm, joinOptions?: JoinOptions): void;
    removeSwarm(swarm: Swarm): void;
    get closedConnectionCount(): number;
    close(): Promise<void>;
    getOrCreatePeer(peerId: PeerId): NetworkPeer;
    private closeSwarm;
    private swarmJoin;
    private swarmLeave;
    private onDiscovery;
    private onConnection;
}
