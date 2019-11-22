import PeerConnection from './PeerConnection';
import MessageBus from './MessageBus';
import NetworkPeer from './NetworkPeer';
import Queue from './Queue';
export interface Routed<Msg> {
    sender: NetworkPeer;
    channelName: string;
    msg: Msg;
}
export default class MessageRouter<Msg> {
    channelName: string;
    buses: WeakMap<PeerConnection, MessageBus<Msg>>;
    inboxQ: Queue<Routed<Msg>>;
    constructor(channelName: string);
    listenTo(peer: NetworkPeer): void;
    sendToPeers(peers: Iterable<NetworkPeer>, msg: Msg): void;
    sendToPeer(peer: NetworkPeer, msg: Msg): void;
    getBus(peer: NetworkPeer): MessageBus<Msg> | undefined;
}
