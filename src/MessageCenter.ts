import PeerConnection from './PeerConnection'
import MessageChannel from './MessageChannel'
import NetworkPeer from './NetworkPeer'
import Queue from './Queue'
import { getOrCreate } from './Misc'

export interface Routed<Msg> {
  sender: NetworkPeer
  channelName: string
  msg: Msg
}

export default class MessageCenter<Msg> {
  channelName: string
  channels: WeakMap<PeerConnection, MessageChannel<Msg>>
  inboxQ: Queue<Routed<Msg>>

  constructor(channelName: string) {
    this.channelName = channelName
    this.channels = new WeakMap()
    this.inboxQ = new Queue('MessageCenter:inboxQ')
  }

  listenTo(peer: NetworkPeer): void {
    this.getChannel(peer)
  }

  sendToPeers(peers: Iterable<NetworkPeer>, msg: Msg): void {
    for (const peer of peers) {
      this.sendToPeer(peer, msg)
    }
  }

  sendToPeer(peer: NetworkPeer, msg: Msg): void {
    const channel = this.getChannel(peer)
    channel.send(msg)
  }

  getChannel(peer: NetworkPeer): MessageChannel<Msg> {
    return getOrCreate(this.channels, peer.connection, (conn) => {
      const channel = new MessageChannel<Msg>(conn.openChannel(this.channelName))

      channel.receiveQ.subscribe((msg) => {
        this.inboxQ.push({
          sender: peer,
          channelName: this.channelName,
          msg,
        })
      })
      return channel
    })
  }
}
