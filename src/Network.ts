import { Duplex } from 'stream'
import * as Base58 from 'bs58'
import HypercoreProtocol from 'hypercore-protocol'
import { DiscoveryId, encodeDiscoveryId } from './Misc'
import Peer, { PeerId, decodePeerId } from './NetworkPeer'
import * as DocumentBroadcast from './DocumentBroadcast'
import FeedStore, { FeedId, discoveryId } from './FeedStore'

interface Swarm {
  join(dk: Buffer): void
  leave(dk: Buffer): void
  on: Function
  removeAllListeners(): void
  discovery: {
    removeAllListeners(): void
    close(): void
  }
  peers: any[]
}

export default class Network {
  selfId: PeerId
  joined: Map<DiscoveryId, FeedId>
  store: FeedStore
  peers: Map<PeerId, Peer>
  swarm?: Swarm

  constructor(selfId: PeerId, store: FeedStore) {
    this.selfId = selfId
    this.store = store
    this.joined = new Map()
    this.peers = new Map()
  }

  join(feedId: FeedId): void {
    const id = discoveryId(feedId)
    if (this.joined.has(id)) return
    if (this.swarm) this.swarm.join(decodeId(id))

    this.joined.set(id, feedId)
  }

  leave(feedId: FeedId): void {
    const id = discoveryId(feedId)
    if (!this.joined.has(id)) return
    if (this.swarm) this.swarm.leave(decodeId(id))
    this.joined.delete(id)
  }

  setSwarm(swarm: Swarm): void {
    if (this.swarm) throw new Error('Swarm already exists!')

    this.swarm = swarm

    for (let id of this.joined.keys()) {
      this.swarm.join(decodeId(id))
    }
  }

  close(): Promise<void> {
    return new Promise((res) => {
      if (!this.swarm) return res()
      this.swarm.discovery.removeAllListeners()
      this.swarm.discovery.close()
      this.swarm.peers.forEach((p: any) => p.connections.forEach((con: any) => con.destroy()))
      this.swarm.removeAllListeners()
      res()
    })
  }

  onConnect = (peerInfo: any) => {
    const protocol = HypercoreProtocol({
      live: true,
      id: decodePeerId(this.selfId),
      encrypt: false,
      timeout: 10000,
      extensions: DocumentBroadcast.SUPPORTED_EXTENSIONS,
    })

    const onFeedRequested = (discoveryKey: Buffer) => {
      const discoveryId = encodeDiscoveryId(discoveryKey)
      const feedId = this.joined.get(discoveryId)

      if (!feedId) throw new Error(`Unknown feed: ${discoveryId}`)

      this.store.getFeed(feedId).then((feed) => {
        feed.replicate({
          stream: protocol,
          live: true,
        })
      })
    }

    protocol.on('feed', onFeedRequested)
    const discoveryKey = peerInfo.channel || peerInfo.discoveryKey

    if (discoveryKey) onFeedRequested(discoveryKey)

    return protocol
  }
}

function decodeId(id: DiscoveryId): Buffer {
  return Base58.decode(id)
}
