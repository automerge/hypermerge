import NetworkPeer from './NetworkPeer'
import HypercoreProtocol from 'hypercore-protocol'
import FeedStore, { FeedId } from './FeedStore'
import PeerConnection from './PeerConnection'
import { getOrCreate, encodeDiscoveryId, DiscoveryId, toDiscoveryId, joinSets } from './Misc'
import MessageCenter, { Routed } from './MessageCenter'
import pump from 'pump'
import MapSet from './MapSet'
import Queue from './Queue'

type ReplicationMsg = DiscoveryIdsMsg

interface DiscoveryIdsMsg {
  type: 'DiscoveryIds'
  discoveryIds: DiscoveryId[]
}

export interface Discovery {
  feedId: FeedId
  discoveryId: DiscoveryId
  peer: NetworkPeer
}

export default class ReplicationManager {
  private discoveryIds: Map<DiscoveryId, FeedId>
  private messages: MessageCenter<ReplicationMsg>
  private peers: Set<NetworkPeer>
  private peersByDiscoveryId: MapSet<DiscoveryId, NetworkPeer>
  private protocols: WeakMap<PeerConnection, HypercoreProtocol>
  private feeds: FeedStore

  discoveryQ: Queue<Discovery>

  constructor(feeds: FeedStore) {
    this.discoveryIds = new Map()
    this.protocols = new WeakMap()
    this.peers = new Set()
    this.peersByDiscoveryId = new MapSet()
    this.discoveryQ = new Queue('ReplicationManager:discoveryQ')
    this.feeds = feeds
    this.messages = new MessageCenter('ReplicationManager')
    this.messages.inboxQ.subscribe(this.onMessage)
  }

  addFeedIds(feedIds: FeedId[]): void {
    const discoveryIds: DiscoveryId[] = []

    for (const feedId of feedIds) {
      const discoveryId = toDiscoveryId(feedId)
      if (!this.discoveryIds.has(discoveryId)) {
        this.discoveryIds.set(discoveryId, feedId)
        discoveryIds.push(discoveryId)
      }
    }

    this.messages.sendToPeers(this.peers, {
      type: 'DiscoveryIds',
      discoveryIds,
    })
  }

  getFeedId(discoveryId: DiscoveryId): FeedId | undefined {
    return this.discoveryIds.get(discoveryId)
  }

  getPeersWith(discoveryIds: DiscoveryId[]): Set<NetworkPeer> {
    return joinSets(discoveryIds.map((id) => this.peersByDiscoveryId.get(id)))
  }

  close(): void {
    this.messages.inboxQ.unsubscribe()
  }

  /**
   * Should be called when a peer connects.
   */
  onPeer = (peer: NetworkPeer): void => {
    this.peers.add(peer)
    this.messages.listenTo(peer)
    this.getOrCreateProtocol(peer)

    if (peer.weHaveAuthority) {
      // NOTE(jeff): In the future, we should send a smaller/smarter set.
      const discoveryIds = Array.from(this.discoveryIds.keys())

      this.messages.sendToPeer(peer, {
        type: 'DiscoveryIds',
        discoveryIds,
      })
    }
  }

  private replicateWith(peer: NetworkPeer, discoveryIds: DiscoveryId[]): void {
    const protocol = this.getOrCreateProtocol(peer)
    for (const discoveryId of discoveryIds) {
      // HACK(jeff): The peer has not yet been verified to have this key. They've
      // only _told_ us that they have it:
      this.peersByDiscoveryId.add(discoveryId, peer)

      const feedId = this.getFeedId(discoveryId)
      if (feedId) {
        this.discoveryQ.push({ feedId, discoveryId, peer })
        this.feeds.getFeed(feedId).then((feed) => {
          feed.replicate(protocol, { live: true })
        })
      }
    }
  }

  private onMessage = ({ msg, sender }: Routed<ReplicationMsg>) => {
    switch (msg.type) {
      case 'DiscoveryIds': {
        const sharedDiscoveryIds = msg.discoveryIds.filter((discoveryId) =>
          this.discoveryIds.has(discoveryId)
        )

        this.replicateWith(sender, sharedDiscoveryIds)
        break
      }
    }
  }

  private getOrCreateProtocol(peer: NetworkPeer): HypercoreProtocol {
    return getOrCreate(this.protocols, peer.connection, (conn) => {
      const stream = conn.openChannel('FeedReplication')
      const protocol = new HypercoreProtocol(conn.isClient, {
        encrypt: false,
        onhandshake() {},
      })

      protocol.once('close', () => this.protocols.delete(conn))

      protocol.on('discovery-key', (discoveryKey) => {
        const discoveryId = encodeDiscoveryId(discoveryKey)

        // Hypercore verifies that the remote has the feed automatically
        this.replicateWith(peer, [discoveryId])
      })

      pump(stream, protocol, stream)

      return protocol
    })
  }
}

function isNil(x: any): x is undefined | null {
  return x == null
}
