import { DiscoveryId } from './Misc';
import Peer, { PeerId } from './NetworkPeer';
import { Swarm, JoinOptions } from './SwarmInterface';
import MapSet from './MapSet';
import Queue from './Queue';
export declare type Host = string & {
    host: true;
};
export default class Network {
    selfId: PeerId;
    joined: Set<DiscoveryId>;
    pending: Set<DiscoveryId>;
    peers: Map<PeerId, Peer>;
    peerDiscoveryIds: MapSet<DiscoveryId, PeerId>;
    hosts: MapSet<Host, DiscoveryId>;
    peerQ: Queue<Peer>;
    swarm?: Swarm;
    joinOptions?: JoinOptions;
    constructor(selfId: PeerId);
    join(discoveryId: DiscoveryId): void;
    leave(discoveryId: DiscoveryId): void;
    setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void;
    close(): Promise<void>;
    getOrCreatePeer(peerId: PeerId): Peer;
    private onConnection;
}
