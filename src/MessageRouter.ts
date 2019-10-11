import PeerConnection from './PeerConnection'
import MessageBus from './MessageBus'
import NetworkPeer from './NetworkPeer'
import Queue from './Queue'
import { getOrCreate } from './Misc'

export interface Routed<Msg> {
  sender: NetworkPeer
  channelName: string
  msg: Msg
}

export default class MessageRouter<Msg> {
  channelName: string
  buses: WeakMap<PeerConnection, MessageBus<Msg>>
  inboxQ: Queue<Routed<Msg>>

  constructor(channelName: string) {
    this.channelName = channelName
    this.buses = new WeakMap()
    this.inboxQ = new Queue('MessageCenter:inboxQ')
  }

  listenTo(peer: NetworkPeer): void {
    this.getBus(peer)
  }

  sendToPeers(peers: Iterable<NetworkPeer>, msg: Msg): void {
    for (const peer of peers) {
      this.sendToPeer(peer, msg)
    }
  }

  sendToPeer(peer: NetworkPeer, msg: Msg): void {
    const bus = this.getBus(peer)
    bus.send(msg)
  }

  getBus(peer: NetworkPeer): MessageBus<Msg> {
    return getOrCreate(this.buses, peer.connection, (conn) => {
      const bus = new MessageBus<Msg>(conn.openChannel(this.channelName))

      bus.receiveQ.subscribe((msg) => {
        this.inboxQ.push({
          sender: peer,
          channelName: this.channelName,
          msg,
        })
      })
      return bus
    })
  }
}
