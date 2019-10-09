import PeerConnection from './PeerConnection';
import MessageChannel from './MessageChannel';
import NetworkPeer from './NetworkPeer';
import Queue from './Queue';
export interface Routed<Msg> {
    sender: NetworkPeer;
    channelName: string;
    msg: Msg;
}
export default class MessageCenter<Msg> {
    channelName: string;
    channels: WeakMap<PeerConnection, MessageChannel<Msg>>;
    inboxQ: Queue<Routed<Msg>>;
    constructor(channelName: string);
    listenTo(peer: NetworkPeer): void;
    sendToPeers(peers: Iterable<NetworkPeer>, msg: Msg): void;
    sendToPeer(peer: NetworkPeer, msg: Msg): void;
    getChannel(peer: NetworkPeer): MessageChannel<Msg>;
}
