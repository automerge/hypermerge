import Network from './Network';
import PeerConnection from './PeerConnection';
import MessageChannel from './MessageChannel';
import { PeerId } from './NetworkPeer';
import Queue from './Queue';
export default class MessageCenter<Msg> {
    channelName: string;
    network: Network;
    channels: WeakMap<PeerConnection, MessageChannel<Msg>>;
    inboxQ: Queue<Msg>;
    constructor(channelName: string, network: Network);
    sendToPeer(peerId: PeerId, msg: Msg): void;
    getChannel(peerId: PeerId): MessageChannel<Msg>;
}
