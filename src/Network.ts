import * as Base58 from 'bs58'
import { DiscoveryId, getOrCreate, encodeDiscoveryId } from './Misc'
import Peer, { PeerId, PeerConnection } from './NetworkPeer'
import { Swarm, JoinOptions, Socket, ConnectionDetails } from './SwarmInterface'
import MapSet from './MapSet'
import Queue from './Queue'

export interface DiscoveryRequest<Msg> {
  discoveryId: DiscoveryId
  connection: PeerConnection<Msg>
  peer: Peer<Msg>
}

export default class Network<Msg> {
  selfId: PeerId
  joined: Set<DiscoveryId>
  pending: Set<DiscoveryId>
  peers: Map<PeerId, Peer<Msg>>
  peerDiscoveryIds: MapSet<DiscoveryId, PeerId>
  inboxQ: Queue<Msg>
  discoveryQ: Queue<DiscoveryRequest<Msg>>
  swarm?: Swarm
  joinOptions?: JoinOptions

  constructor(selfId: PeerId) {
    this.selfId = selfId
    this.joined = new Set()
    this.pending = new Set()
    this.peers = new Map()
    this.discoveryQ = new Queue('Network:discoveryQ')
    this.inboxQ = new Queue('Network:receiveQ')
    this.peerDiscoveryIds = new MapSet()
    this.joinOptions = { announce: true, lookup: true }
  }

  join(discoveryId: DiscoveryId): void {
    if (this.swarm) {
      if (this.joined.has(discoveryId)) return

      this.joined.add(discoveryId)
      this.swarm.join(decodeId(discoveryId), this.joinOptions)
      this.pending.delete(discoveryId)
    } else {
      this.pending.add(discoveryId)
    }
  }

  leave(discoveryId: DiscoveryId): void {
    this.pending.delete(discoveryId)
    if (!this.joined.has(discoveryId)) return

    if (this.swarm) this.swarm.leave(decodeId(discoveryId))
    this.joined.delete(discoveryId)
  }

  sendToDiscoveryId(discoveryId: DiscoveryId, msg: Msg): void {
    this.peerDiscoveryIds.get(discoveryId).forEach((peerId) => {
      this.sendToPeer(peerId, msg)
    })
  }

  sendToPeer(peerId: PeerId, msg: Msg): void {
    const peer = this.peers.get(peerId)
    if (peer && peer.connection) {
      peer.connection.messages.send(msg)
    }
  }

  setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void {
    if (this.swarm) throw new Error('Swarm already exists!')

    if (joinOptions) this.joinOptions = joinOptions
    this.swarm = swarm
    this.swarm.on('connection', this.onConnection)

    for (const discoveryId of this.pending) {
      this.join(discoveryId)
    }
  }

  getOrCreatePeer(peerId: PeerId): Peer<Msg> {
    return getOrCreate(this.peers, peerId, () => new Peer(this.selfId, peerId))
  }

  close(): void {
    if (!this.swarm) return

    this.peers.forEach((peer) => {
      peer.close()
    })

    // TODO: this is not enough:
    this.swarm.removeAllListeners()
  }

  private onConnection = async (socket: Socket, details: ConnectionDetails) => {
    const conn = await PeerConnection.fromSocket<Msg>(socket, this.selfId, details)

    const peer = this.getOrCreatePeer(conn.peerId)

    if (peer.addConnection(conn)) {
      conn.messages.subscribe(this.inboxQ.push)

      conn.discoveryQ.subscribe((discoveryId) => {
        this.join(discoveryId)
        this.peerDiscoveryIds.add(discoveryId, peer.id)

        this.discoveryQ.push({
          discoveryId,
          connection: conn,
          peer,
        })
      })
    }
  }
}

function decodeId(id: DiscoveryId): Buffer {
  return Base58.decode(id)
}
