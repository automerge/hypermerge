import Network from './Network'
import PeerConnection from './PeerConnection'
import MessageChannel from './MessageChannel'
import { PeerId } from './NetworkPeer'
import Queue from './Queue'
import { getOrCreate } from './Misc'

export default class MessageCenter<Msg> {
  channelName: string
  network: Network
  channels: WeakMap<PeerConnection, MessageChannel<Msg>>
  inboxQ: Queue<Msg>

  constructor(channelName: string, network: Network) {
    this.channelName = channelName
    this.network = network
    this.channels = new WeakMap()
    this.inboxQ = new Queue('MessageCenter:inboxQ')
  }

  sendToPeer(peerId: PeerId, msg: Msg): void {
    const channel = this.getChannel(peerId)
    channel.send(msg)
  }

  getChannel(peerId: PeerId): MessageChannel<Msg> {
    const peer = this.network.peers.get(peerId)
    if (!peer) throw new Error(`Missing peer: ${peerId}`)

    return getOrCreate(this.channels, peer.connection, (conn) => {
      const stream = conn.openChannel(this.channelName)

      const channel = new MessageChannel<Msg>(stream)
      channel.receiveQ.subscribe(this.inboxQ.push)
      return channel
    })
  }
}
