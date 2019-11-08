import { DiscoveryId, getOrCreate, decodeId } from './Misc'
import NetworkPeer, { PeerId } from './NetworkPeer'
import { Swarm, JoinOptions, Socket, ConnectionDetails } from './SwarmInterface'
import Queue from './Queue'
import PeerConnection from './PeerConnection'

export default class Network {
  selfId: PeerId
  joined: Set<DiscoveryId>
  peers: Map<PeerId, NetworkPeer>
  peerQ: Queue<NetworkPeer>
  swarm?: Swarm
  joinOptions?: JoinOptions

  constructor(selfId: PeerId) {
    this.selfId = selfId
    this.joined = new Set()
    this.peers = new Map()
    this.peerQ = new Queue('Network:peerQ')
    this.joinOptions = { announce: true, lookup: true }
  }

  join(discoveryId: DiscoveryId): void {
    if (this.joined.has(discoveryId)) return
    this.joined.add(discoveryId)
    this.swarmJoin(discoveryId)
  }

  leave(discoveryId: DiscoveryId): void {
    if (!this.joined.has(discoveryId)) return
    this.joined.delete(discoveryId)
    this.swarmLeave(discoveryId)
  }

  setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void {
    if (this.swarm) throw new Error('Swarm already exists!')

    if (joinOptions) this.joinOptions = joinOptions
    this.swarm = swarm
    this.swarm.on('connection', this.onConnection)
    this.swarm.on('listening', this.onListening)
  }

  get closedConnectionCount(): number {
    let count = 0
    for (const peer of this.peers.values()) {
      count += peer.closedConnectionCount
    }
    return count
  }

  async close(): Promise<void> {
    this.peers.forEach((peer) => {
      peer.close()
    })

    return new Promise((res) => {
      this.swarm ? this.swarm.destroy(res) : res()
    })
  }

  getOrCreatePeer(peerId: PeerId) {
    return getOrCreate(this.peers, peerId, () => {
      const peer = new NetworkPeer(this.selfId, peerId)

      peer.connectionQ.subscribe((_conn) => {
        this.peerQ.push(peer)
      })

      return peer
    })
  }

  private swarmJoin(discoveryId: DiscoveryId): void {
    if (this.swarm) this.swarm.join(decodeId(discoveryId), this.joinOptions)
  }

  private swarmLeave(discoveryId: DiscoveryId): void {
    if (this.swarm) this.swarm.leave(decodeId(discoveryId))
  }

  private onListening = () => {
    for (const discoveryId of this.joined) {
      this.swarmJoin(discoveryId)
    }
  }

  private onConnection = async (socket: Socket, details: ConnectionDetails) => {
    details.reconnect(false)

    const conn = new PeerConnection(socket, {
      isClient: details.client,
      type: details.type,
      onClose() {
        if (!conn.isConfirmed) details.ban()
      },
    })

    conn.networkBus.send({
      type: 'Info',
      peerId: this.selfId,
    })

    const firstMsg = await conn.networkBus.receiveQ.first()

    if (firstMsg.type !== 'Info') throw new Error('First message must be Info.')

    const { peerId } = firstMsg
    if (peerId === this.selfId) throw new Error('Connected to self.')

    this.getOrCreatePeer(peerId).addConnection(conn)
  }
}
