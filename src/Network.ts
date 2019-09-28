import * as Base58 from 'bs58'
import { DiscoveryId, getOrCreate, encodeDiscoveryId } from './Misc'
import Peer, { PeerId, PeerConnection } from './NetworkPeer'
import { Swarm, JoinOptions, Socket, ConnectionDetails, PeerInfo } from './SwarmInterface'
import MapSet from './MapSet'
import Queue from './Queue'

export type Host = string & { host: true }

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
  hosts: MapSet<Host, DiscoveryId>
  peersByHost: Map<Host, Peer<Msg>>
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
    this.hosts = new MapSet()
    this.peersByHost = new Map()
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
    this.swarm.on('peer', this.onDiscovery)

    for (const discoveryId of this.pending) {
      this.join(discoveryId)
    }
  }

  getOrCreatePeer(peerId: PeerId): Peer<Msg> {
    return getOrCreate(this.peers, peerId, () => new Peer(this.selfId, peerId))
  }

  async close(): Promise<void> {
    this.peers.forEach((peer) => {
      peer.close()
    })

    return new Promise((res) => {
      this.swarm ? this.swarm.destroy(res) : res()
    })
  }

  private onDiscovery = async (peerInfo: PeerInfo) => {
    const discoveryId = encodeDiscoveryId(peerInfo.topic!)
    // We want hyperswarm to dedupe without including the topic,
    // so we delete it here:

    delete peerInfo.topic
    const host = createHost(peerInfo)
    this.hosts.add(host, discoveryId)

    const peer = this.peersByHost.get(host)

    if (peer && peer.connection) {
      peer.connection.addDiscoveryId(discoveryId)
    }
  }

  private onConnection = async (socket: Socket, details: ConnectionDetails) => {
    const conn = await PeerConnection.fromSocket<Msg>(socket, this.selfId, details)

    const peer = this.getOrCreatePeer(conn.peerId)
    const host = details.peer ? createHost(details.peer) : null

    if (host) this.peersByHost.set(host, peer)

    if (peer.addConnection(conn)) {
      if (host) conn.addDiscoveryIds(this.hosts.get(host))

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

function createHost({ host, port }: PeerInfo): Host {
  return `${host}:${port}` as Host
}
