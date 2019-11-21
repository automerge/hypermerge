import { DiscoveryId, getOrCreate, decodeId } from './Misc'
import NetworkPeer, { PeerId } from './NetworkPeer'
import { Swarm, JoinOptions, ConnectionDetails, PeerInfo } from './SwarmInterface'
import Queue from './Queue'
import PeerConnection from './PeerConnection'
import { Duplex } from 'stream'

export type NetworkMsg = InfoMsg

export interface InfoMsg {
  type: 'Info'
  peerId: PeerId
}

export default class Network {
  selfId: PeerId
  joined: Set<DiscoveryId>
  peers: Map<PeerId, NetworkPeer>
  peerQ: Queue<NetworkPeer>
  discovered: Set<string>
  swarms: Map<Swarm, JoinOptions>

  constructor(selfId: PeerId) {
    this.selfId = selfId
    this.joined = new Set()
    this.peers = new Map()
    this.swarms = new Map()
    this.discovered = new Set()
    this.peerQ = new Queue('Network:peerQ')
  }

  join(discoveryId: DiscoveryId): void {
    if (this.joined.has(discoveryId)) return
    this.joined.add(discoveryId)
    for (const swarm of this.swarms.keys()) {
      this.swarmJoin(swarm, discoveryId)
    }
  }

  leave(discoveryId: DiscoveryId): void {
    if (!this.joined.has(discoveryId)) return
    this.joined.delete(discoveryId)
    for (const swarm of this.swarms.keys()) {
      this.swarmLeave(swarm, discoveryId)
    }
  }

  /** @deprecated */
  get swarm(): Swarm | undefined {
    return Array.from(this.swarms.keys())[0]
  }

  /**
   * @deprecated Use `addSwarm`
   */
  setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void {
    this.addSwarm(swarm, joinOptions)
  }

  addSwarm(swarm: Swarm, joinOptions: JoinOptions = { announce: true, lookup: true }): void {
    if (this.swarms.has(swarm)) return

    this.swarms.set(swarm, joinOptions)
    swarm.on('connection', this.onConnection)
    swarm.on('peer', this.onDiscovery)

    for (const discoveryId of this.joined) {
      this.swarmJoin(swarm, discoveryId)
    }
  }

  removeSwarm(swarm: Swarm): void {
    this.swarms.delete(swarm)
    swarm.off('connection', this.onConnection)
    swarm.off('peer', this.onDiscovery)
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

    await Promise.all(Array.from(this.swarms.keys()).map((swarm) => this.closeSwarm(swarm)))
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

  private closeSwarm(swarm: Swarm): Promise<void> {
    return new Promise((res) => {
      this.removeSwarm(swarm)
      swarm.destroy(res)
    })
  }

  private swarmJoin(swarm: Swarm, discoveryId: DiscoveryId): void {
    swarm.join(decodeId(discoveryId), this.swarms.get(swarm))
  }

  private swarmLeave(swarm: Swarm, discoveryId: DiscoveryId): void {
    swarm.leave(decodeId(discoveryId))
  }

  private onDiscovery = (peerInfo: PeerInfo) => {
    const type = peerInfo.local ? 'mdns' : 'dht'
    this.discovered.add(`${type}@${peerInfo.host}:${peerInfo.port}`)
  }

  private onConnection = async (socket: Duplex, details: ConnectionDetails) => {
    const conn = new PeerConnection(socket, {
      isClient: details.client,
      type: details.type,
    })

    const networkBus = conn.openBus<NetworkMsg>('NetworkMsg')

    networkBus.send({
      type: 'Info',
      peerId: this.selfId,
    })

    const firstMsg = await networkBus.receiveQ.first()

    networkBus.close()

    if (firstMsg.type !== 'Info') throw new Error('First message must be Info.')

    const { peerId } = firstMsg
    if (peerId === this.selfId) throw new Error('Connected to self.')

    this.getOrCreatePeer(peerId).addConnection(conn)
  }
}
