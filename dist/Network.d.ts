import { DiscoveryId } from './Misc';
import Peer, { PeerId, PeerConnection } from './NetworkPeer';
import { Swarm, JoinOptions } from './SwarmInterface';
import MapSet from './MapSet';
import Queue from './Queue';
export declare type Host = string & {
    host: true;
};
export interface DiscoveryRequest<Msg> {
    discoveryId: DiscoveryId;
    connection: PeerConnection<Msg>;
    peer: Peer<Msg>;
}
export default class Network<Msg> {
    selfId: PeerId;
    joined: Set<DiscoveryId>;
    pending: Set<DiscoveryId>;
    peers: Map<PeerId, Peer<Msg>>;
    peerDiscoveryIds: MapSet<DiscoveryId, PeerId>;
    hosts: MapSet<Host, DiscoveryId>;
    peersByHost: Map<Host, Peer<Msg>>;
    inboxQ: Queue<Msg>;
    discoveryQ: Queue<DiscoveryRequest<Msg>>;
    swarm?: Swarm;
    joinOptions?: JoinOptions;
    constructor(selfId: PeerId);
    join(discoveryId: DiscoveryId): void;
    leave(discoveryId: DiscoveryId): void;
    sendToDiscoveryId(discoveryId: DiscoveryId, msg: Msg): void;
    sendToPeer(peerId: PeerId, msg: Msg): void;
    setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void;
    getOrCreatePeer(peerId: PeerId): Peer<Msg>;
    close(): Promise<void>;
    private onDiscovery;
    private onConnection;
}
